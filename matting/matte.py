"""RobustVideoMatting sidecar for MChiodi Editor: video -> alpha matte (gray video).

Contract (consumed by the TypeScript pipeline, src/render/matte.ts): matte video on --output
(same size and fps as the input), progress on stderr as `PROGRESS <0-100> <stage>`,
nothing on stdout, exit code != 0 on error.

Logic taken from PeterL1n/RobustVideoMatting: the recurrent state (r1..r4) is carried from
frame to frame, which keeps the edge stable; the network runs at `downsample_ratio` and a
guided filter refines the alpha back to full resolution.
"""

import argparse
import os
import subprocess
import sys
import urllib.request

MODEL_BASE = "https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/"
MODELS = {
    "mobilenetv3": "rvm_mobilenetv3_fp32.torchscript",
    "resnet50": "rvm_resnet50_fp32.torchscript",
}
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
MIN_MODEL_BYTES = 1_000_000


def progress(pct, stage):
    print(f"PROGRESS {max(0, min(100, int(pct)))} {stage}", file=sys.stderr, flush=True)


def log(msg):
    print(msg, file=sys.stderr, flush=True)


def parse_args():
    p = argparse.ArgumentParser(description="Video -> alpha matte with RobustVideoMatting.")
    p.add_argument("--input", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--width", type=int, required=True)
    p.add_argument("--height", type=int, required=True)
    p.add_argument("--fps", type=float, required=True)
    p.add_argument("--frames", type=int, default=0, help="expected frame count, for progress only")
    p.add_argument("--variant", choices=sorted(MODELS), default="mobilenetv3")
    p.add_argument("--downsample", type=float, required=True, help="fraction of the resolution the network runs at")
    p.add_argument("--device", choices=["cuda", "cpu"], default="cuda")
    p.add_argument(
        "--scene-reset",
        type=float,
        default=0.25,
        help="mean luminance jump (0-1) between frames above which the recurrent state is reset",
    )
    return p.parse_args()


def ensure_model(variant):
    """Model file in matting/models/, downloaded once from the official release."""
    name = MODELS[variant]
    path = os.path.join(MODEL_DIR, name)
    if os.path.exists(path) and os.path.getsize(path) >= MIN_MODEL_BYTES:
        return path
    os.makedirs(MODEL_DIR, exist_ok=True)
    log(f"baixando {name} (uma vez)")
    part = path + ".part"
    urllib.request.urlretrieve(MODEL_BASE + name, part)
    if os.path.getsize(part) < MIN_MODEL_BYTES:
        os.remove(part)
        raise RuntimeError(f"download incompleto de {name}")
    os.replace(part, path)
    return path


def read_exact(stream, size):
    chunks, remaining = [], size
    while remaining > 0:
        chunk = stream.read(remaining)
        if not chunk:
            return None  # EOF (a trailing partial frame is dropped)
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


def main():
    args = parse_args()

    import torch
    import torch.nn.functional as F

    device = args.device
    if device == "cuda" and not torch.cuda.is_available():
        log("aviso: CUDA indisponível, usando CPU")
        device = "cpu"

    progress(2, "load-model")
    model = torch.jit.load(ensure_model(args.variant), map_location=device).eval()
    model = torch.jit.freeze(model)

    w, h = args.width, args.height
    frame_bytes = w * h * 3
    decoder = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-nostdin", "-i", args.input, "-an", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        stdout=subprocess.PIPE,
    )
    encoder = subprocess.Popen(
        [
            "ffmpeg", "-v", "error", "-nostdin", "-y",
            "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{w}x{h}", "-r", str(args.fps), "-i", "-",
            "-c:v", "ffv1", args.output,
        ],
        stdin=subprocess.PIPE,
    )

    rec = [None] * 4
    previous = None
    count = 0
    try:
        with torch.no_grad():
            while True:
                raw = read_exact(decoder.stdout, frame_bytes)
                if raw is None:
                    break
                src = (
                    torch.frombuffer(bytearray(raw), dtype=torch.uint8)
                    .view(h, w, 3)
                    .permute(2, 0, 1)
                    .unsqueeze(0)
                    .to(device)
                    .float()
                    .div(255)
                )
                # corte seco de cena: o estado recorrente da cena anterior só atrapalha
                small = F.interpolate(src.mean(dim=1, keepdim=True), size=(36, 64), mode="area")
                if previous is not None and (small - previous).abs().mean().item() > args.scene_reset:
                    rec = [None] * 4
                previous = small

                _, pha, *rec = model(src, *rec, args.downsample)
                encoder.stdin.write((pha[0, 0] * 255).clamp(0, 255).byte().cpu().numpy().tobytes())
                count += 1
                if args.frames and count % 15 == 0:
                    progress(5 + 95 * count / args.frames, "matte")
    finally:
        if encoder.stdin:
            encoder.stdin.close()
        decoder.stdout.close()
        decoder.wait()
        encoder.wait()

    if decoder.returncode != 0 or encoder.returncode != 0:
        raise RuntimeError(f"ffmpeg falhou (decoder={decoder.returncode}, encoder={encoder.returncode})")
    if count == 0:
        raise RuntimeError("nenhum quadro lido do vídeo")
    progress(100, "done")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001 - the contract is exit != 0 with the message on stderr
        log(f"erro: {error}")
        sys.exit(1)
