# Security Policy

## Supported versions

Only the latest commit on `main` receives fixes. There are no maintained release branches.

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report it privately through GitHub:
[Security → Report a vulnerability](https://github.com/MatheusChiodi/editor-mchiodi/security/advisories/new).

Include what you found, how to reproduce it and what an attacker could do with it. You should get a first answer
within 7 days. Once a fix is on `main`, the advisory is published with credit to you, unless you prefer otherwise.

## Scope

editor-mchiodi runs locally on the author's machine. The areas where a flaw matters most:

- **The unattended mode** (`mce watch`): it starts headless `claude -p` sessions with a restricted tool allowlist.
  Anything that lets a file dropped in `inbox/` escape that allowlist or run arbitrary commands is in scope.
- **The MChiodi Cut local server** (`mce cut`): it must only listen on localhost and only touch files inside the
  project. Path traversal, cross-origin access or command injection through it are in scope.
- **Secrets** (the ntfy topic in `mce.config.json`, the `PEXELS_API_KEY` environment variable, anything in `.env`):
  any path that writes them to logs, reports, renders or the git history is in scope.
- **Command and filtergraph construction**: a file name or EDL value that injects options into ffmpeg is in scope.

Out of scope: vulnerabilities in ffmpeg, Remotion, WhisperX, Claude Code or other dependencies themselves (report
those upstream), and attacks that require someone who already controls your machine.
