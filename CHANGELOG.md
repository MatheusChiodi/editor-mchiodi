# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- MIT license.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `SECURITY.md` and this changelog.
- Issue templates (bug, feature) and a pull request template.
- CI on GitHub Actions (Windows): typecheck, tests and the MChiodi Cut build.
- Dependabot for npm, the `transcriber` (uv) and GitHub Actions.
- `.editorconfig` and `.gitattributes`: LF everywhere (CRLF for `.bat`/`.cmd`/`.ps1`), which removes the
  "LF will be replaced by CRLF" warnings on Windows.

### Changed

- Project renamed from `mchiodi-editor` to `editor-mchiodi` (package, transcriber, global `mce` shim marker).
  Shims installed before the rename are still recognized by `pnpm run install-cli` and `--uninstall`.

### Fixed

- `pnpm-lock.yaml` was out of sync with `package.json`, which broke `pnpm install --frozen-lockfile`.

## [0.1.0] - 2026-10-16

First version.

### Added

- Pipeline `analyze` → `draft` → EDL → `render` → `eval` → `render --final` → `report`, driven by Claude Code
  through the `mce` CLI and the `edit-video` / `edl-reference` skills.
- Editing levels `limpa`, `normal`, `pro` and `max`.
- Arsenal of motion graphics, transitions and effects in Remotion; reusable animation models.
- Vertical Short (9:16) with automatic stretch suggestion, dynamic presenter focus and re-laid-out graphics.
- Caption style catalog, audio fades on every cut edge, optional neural denoise and camera stabilization.
- Visual and cut-edge evaluation with a contact sheet.
- Retention loop from YouTube Studio data (`mce retention`).
- Assisted b-roll (`mce broll index/suggest/fetch`).
- MChiodi Cut: local visual editor over the EDL (`mce cut`, `mchiodi-cut.bat`).

[Unreleased]: https://github.com/MatheusChiodi/editor-mchiodi/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/MatheusChiodi/editor-mchiodi/releases/tag/v0.1.0
