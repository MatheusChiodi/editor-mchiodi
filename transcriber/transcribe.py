"""WhisperX sidecar for MChiodi Editor: 16 kHz mono wav -> word-level JSON.

Contract (consumed by the TypeScript pipeline): JSON on --output, progress on
stderr as `PROGRESS <0-100> <stage>`, nothing on stdout, exit code != 0 on error.
"""

import argparse
import contextlib
import gc
import json
import os
import sys
import time

SAMPLE_RATE = 16000
CPU_COMPUTE_TYPE = "int8"


def progress(pct, stage):
    print(f"PROGRESS {max(0, min(100, int(pct)))} {stage}", file=sys.stderr, flush=True)


def log(msg):
    print(msg, file=sys.stderr, flush=True)


def parse_args():
    p = argparse.ArgumentParser(description="Transcribe audio to word-level JSON with WhisperX.")
    p.add_argument("--input", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--language", default="pt")
    p.add_argument("--model", default="large-v3")
    p.add_argument("--device", choices=["cuda", "cpu"], default="cuda")
    p.add_argument("--compute-type", default="int8_float16")
    p.add_argument("--batch-size", type=int, default=4)
    p.add_argument("--no-align", action="store_true")
    p.add_argument("--prompt", default=None, help="initial_prompt passed to Whisper")
    return p.parse_args()


def free_gpu():
    import torch

    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


def run_asr(audio, args, device, compute_type):
    import whisperx

    progress(5, "load-model")
    model = whisperx.load_model(
        args.model,
        device,
        compute_type=compute_type,
        language=args.language,
        asr_options={"initial_prompt": args.prompt},
    )
    try:
        progress(10, "transcribe")
        return model.transcribe(
            audio,
            batch_size=args.batch_size,
            language=args.language,
            progress_callback=lambda pct: progress(10 + pct * 0.6, "transcribe"),
        )
    finally:
        # Whisper must leave the GPU before the wav2vec2 aligner is loaded (6 GB card).
        del model
        free_gpu()


def run_align(result, audio, language, device):
    import whisperx

    progress(75, "load-align-model")
    align_model, metadata = whisperx.load_align_model(language_code=language, device=device)
    try:
        progress(78, "align")
        return whisperx.align(
            result["segments"],
            align_model,
            metadata,
            audio,
            device,
            return_char_alignments=False,
            progress_callback=lambda pct: progress(78 + pct * 0.19, "align"),
        )
    finally:
        del align_model
        free_gpu()


def has_time(word):
    return isinstance(word.get("start"), (int, float)) and isinstance(word.get("end"), (int, float))


def collect_words(segments):
    """Flatten segment words; unaligned segments are split on whitespace with no timing."""
    words = []
    for idx, seg in enumerate(segments):
        raw = seg.get("words") or [{"word": w} for w in seg.get("text", "").split()]
        for w in raw:
            text = str(w.get("word", "")).strip()
            if not text:
                continue
            timed = has_time(w)
            words.append(
                {
                    "text": text,
                    "start": float(w["start"]) if timed else None,
                    "end": float(w["end"]) if timed else None,
                    "score": float(w.get("score") or 0.0) if timed else 0.0,
                    "segment": idx,
                    "interpolated": not timed,
                }
            )
    return words


def interpolate(words, segments, duration):
    """Give untimed words an even share of the gap between their timed neighbours."""
    i = 0
    while i < len(words):
        if words[i]["start"] is not None:
            i += 1
            continue
        j = i
        while j < len(words) and words[j]["start"] is None and words[j]["segment"] == words[i]["segment"]:
            j += 1
        seg_start = float(segments[words[i]["segment"]]["start"])
        seg_end = float(segments[words[i]["segment"]]["end"])
        left = max(words[i - 1]["end"], seg_start) if i > 0 else seg_start
        next_timed = j < len(words) and words[j]["start"] is not None
        right = min(words[j]["start"], seg_end) if next_timed else seg_end
        left = min(max(left, 0.0), duration)
        right = min(max(right, left), duration)
        step = (right - left) / (j - i)
        for k in range(i, j):
            words[k]["start"] = left + step * (k - i)
            words[k]["end"] = left + step * (k - i + 1)
        i = j


def enforce_order(words):
    prev = None
    for w in words:
        if prev is not None:
            w["start"] = max(w["start"], prev["start"])
            if prev["end"] > w["start"]:
                prev["end"] = w["start"]
        w["end"] = max(w["end"], w["start"])
        prev = w
    for w in words:
        w["start"] = round(w["start"], 3)
        w["end"] = round(max(w["end"], w["start"]), 3)
        w["score"] = round(w["score"], 3)


def write_json(path, payload):
    out_dir = os.path.dirname(os.path.abspath(path))
    os.makedirs(out_dir, exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        json.dump(payload, f, ensure_ascii=False)
    os.replace(tmp, path)


def main():
    args = parse_args()
    if not os.path.isfile(args.input):
        log(f"ERROR input not found: {args.input}")
        return 2

    started = time.perf_counter()
    progress(0, "load-audio")
    import torch
    import whisperx

    audio = whisperx.load_audio(args.input)
    duration = len(audio) / SAMPLE_RATE

    device, compute_type, fallback = args.device, args.compute_type, None
    if device == "cuda" and not torch.cuda.is_available():
        device, compute_type = "cpu", CPU_COMPUTE_TYPE
        fallback = "cuda unavailable; ran on cpu int8"

    try:
        result = run_asr(audio, args, device, compute_type)
    except Exception as exc:
        if device != "cuda":
            raise
        log(f"WARN cuda transcription failed, retrying on cpu: {exc}")
        free_gpu()
        device, compute_type = "cpu", CPU_COMPUTE_TYPE
        fallback = f"cuda transcription failed ({type(exc).__name__}: {exc}); ran on cpu int8"
        result = run_asr(audio, args, device, compute_type)

    language = result.get("language") or args.language
    progress(72, "unload-model")

    aligned = False
    if not args.no_align and result["segments"]:
        try:
            result = run_align(result, audio, language, device)
        except Exception as exc:
            if device != "cuda":
                raise
            log(f"WARN cuda alignment failed, retrying on cpu: {exc}")
            free_gpu()
            note = f"cuda alignment failed ({type(exc).__name__}: {exc}); aligned on cpu"
            fallback = f"{fallback}; {note}" if fallback else note
            result = run_align(result, audio, language, "cpu")
        aligned = True

    progress(97, "write-output")
    segments = result["segments"]
    words = collect_words(segments)
    interpolate(words, segments, duration)
    enforce_order(words)

    payload = {
        "meta": {
            "model": args.model,
            "device": device,
            "computeType": compute_type,
            "language": language,
            "aligned": aligned,
            "durationSec": round(duration, 3),
            "elapsedSec": 0.0,
            "fallback": fallback,
        },
        "segments": [
            {
                "id": idx,
                "start": round(float(seg["start"]), 3),
                "end": round(float(seg["end"]), 3),
                "text": seg.get("text", "").strip(),
            }
            for idx, seg in enumerate(segments)
        ],
        "words": words,
    }
    payload["meta"]["elapsedSec"] = round(time.perf_counter() - started, 3)
    write_json(args.output, payload)
    progress(100, "done")
    return 0


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8", errors="replace")
    try:
        # Libraries print to stdout; the contract keeps it clean.
        with contextlib.redirect_stdout(sys.stderr):
            code = main()
    except KeyboardInterrupt:
        log("ERROR interrupted")
        code = 130
    except Exception as exc:
        log(f"ERROR {type(exc).__name__}: {exc}")
        code = 1
    sys.exit(code)
