## GGBond v0.2.6

## Highlights

- Added a **one-time legacy session import marker** to stop repeated migration scans and improve startup stability.
- Added **bundled Next standalone server startup in Tauri release app** so packaged builds can serve `/api/*` endpoints.
- Added **Tauri release workflow hardening** for macOS + Windows packaging with strict signing/notarization checks.
- Updated release docs to a **Tauri-native macOS signing/notarization guide**.
- Updated macOS bundle signing config to avoid broken ad-hoc signatures in local unsigned builds.

## Session Migration

- Legacy session DB merge now runs once and writes a marker file to avoid repeated imports.
- Existing non-empty DB is treated as source-of-truth and migration is skipped safely.
- Improves reliability for users who could not find historical sessions after upgrades.

## Fixes

- `lib/db.ts`: one-time legacy migration marker + safer legacy import gate.
- `src-tauri/src/lib.rs`: start bundled Next server in release mode and redirect app window to local server URL.
- `scripts/prepare-tauri-server.cjs`: package Next standalone runtime into Tauri resources.
- `src-tauri/tauri.conf.json`: include standalone server resources; set local ad-hoc signing fallback.
- `.github/workflows/release-tauri.yml`: enforce required macOS signing/notarization secrets.
- `docs/macos-release.md`: replaced old Electron flow with Tauri signing/notarization steps.
- `README.md` / `README.zh-CN.md`: clarified signed release expectations for macOS users.

## Downloads

- macOS (Apple Silicon): `ggbond_0.2.6_aarch64.dmg`
- Windows (Intel/x64): `ggbond_0.2.6_x64-setup.exe`

Full Changelog: [`v0.2.5...v0.2.6`](https://github.com/Kevoyuan/GGBond/compare/v0.2.5...v0.2.6)
