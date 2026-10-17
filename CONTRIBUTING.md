# Contributing

Thanks for your interest in editor-mchiodi. This is a personal tool built for one YouTube channel, so the bar for
new features is "does it make the MChiodi edits better?". Bug fixes, tests, docs and portability improvements are
always welcome.

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- **Bugs:** open an issue with the [bug template](https://github.com/MatheusChiodi/editor-mchiodi/issues/new?template=bug_report.yml).
  Include `pnpm mce doctor` output and, when it is about an edit, the EDL version (`edl.vN.json`) involved.
- **Features:** open an issue with the [feature template](https://github.com/MatheusChiodi/editor-mchiodi/issues/new?template=feature_request.yml)
  before writing code, so we can agree on the shape.
- **Security problems:** do not open a public issue. See [SECURITY.md](SECURITY.md).

## Setup

Follow [Installation (Windows)](README.md#installation-windows) in the README. In short:

```powershell
pnpm install
pnpm test
pnpm typecheck
```

The integration tests run ffmpeg on synthetic media, so `ffmpeg` and `ffprobe` must be on your `PATH`.

## Rules of the codebase

The full list lives in [`CLAUDE.md`](CLAUDE.md); these are the ones reviews check first:

- **Every new piece of code has a unit test** (Vitest, in `tests/`). Logic goes into pure functions; whatever calls
  ffmpeg or Remotion stays in a thin shell covered by an integration test on synthetic media.
- **The EDL is the single source of truth.** Never edit video "on the side" with loose ffmpeg calls.
- **All EDL times are in seconds of the source file.** The renderer converts.
- Strict TypeScript, ESM. Imports carry the `.ts` extension in `src/` and none in `motion/`.
- Code in English; user-facing messages, comments and docs in Brazilian Portuguese. Comments only for the *why*.
- New motion components use only tokens from `motion/src/theme.ts` and animate through `useCurrentFrame()`.
- New animations start from `pnpm mce scenes new <Name>`.
- Read the "Decisões técnicas" section of `CLAUDE.md` before changing cuts, audio filters or the filtergraph:
  each item there was measured, and undoing it without measuring again brings the bug back.

Formatting follows [`.editorconfig`](.editorconfig) (LF, UTF-8, 2 spaces). Line endings are enforced by
[`.gitattributes`](.gitattributes).

## Pull requests

1. Branch from `main` (`feat/...`, `fix/...`, `docs/...`, `chore/...`).
2. Commit messages in Portuguese, short imperative, with a type prefix: `feat: ...`, `fix: ...`, `docs: ...`,
   `chore: ...`, `test: ...`, `refactor: ...`.
3. Run `pnpm test` and `pnpm typecheck` locally. CI runs both plus `pnpm cut:build` on Windows.
4. When the change affects what a video looks or sounds like, attach a still (`pnpm mce still ...`) or a short clip.
5. Add a line under `[Unreleased]` in [CHANGELOG.md](CHANGELOG.md).
6. Fill in the pull request template.

## License

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
