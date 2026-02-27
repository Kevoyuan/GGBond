## GGBond v0.2.17

## Highlights

- Fixed packaged app data mismatch by unifying runtime storage with **`~/.gemini`**.
- Added storage diagnostics in app settings to show active DB/runtime paths.
- Restored titlebar drag behavior and improved frameless interaction handling.

## Storage & Runtime

- Unified runtime home and DB resolution to `~/.gemini` for packaged and dev parity.
- Added storage debug API and UI panel:
  - `DB Path`
  - `Runtime Home`
  - `GEMINI_CLI_HOME`
  - session totals (active/archived)
- Improved packaged startup flow:
  - prefer bundled Node runtime
  - fallback to system Node when needed

## Dependency & Build Updates

- `package.json`: bumped `@google/gemini-cli-core` to `^0.30.0`.
- `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock`: version `0.2.17`, crate type `rlib`.
- Improved Tauri packaging/runtime scripts and config for desktop distribution.

## UI & Window Behavior

- Restored drag initiation on titlebar root mouse-down.
- Added no-drag filtering for interactive elements (`button`, `input`, `select`, links, `.no-drag`).
- Reduced drag/interaction conflicts for branch selector, stats hover panel, and titlebar actions.

## Downloads

- macOS (Apple Silicon): `ggbond_0.2.17_aarch64.dmg`
- Windows (Intel/x64): `ggbond_0.2.17_x64-setup.exe`

Full Changelog: [`v0.2.16...v0.2.17`](https://github.com/Kevoyuan/GGBond/compare/v0.2.16...v0.2.17)
