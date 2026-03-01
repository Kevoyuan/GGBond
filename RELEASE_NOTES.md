## GGBond v0.3.0

## Highlights

- **Liquid Glass Aesthetic**: Unified the sidebar, module dialogs, and panels with a sleek "Liquid Glass" design.
- **Analytics & Performance**: Redesigned dashboard with historical data navigation and real-time performance tracking.
- **Extreme Performance**: Optimized layout-shift mitigation and GPU-accelerated transitions.

## UI & Analytics Overhaul

- Redesigned `PerformancePanel` and `AnalyticsDashboard` with smooth animations and better I/O visualization.
- Added historical data browsing with month navigation in the analytics view.
- Unified `ActionModules`, `CommandModules`, and `SystemModules` styling.
- Improved `ModulesDialog` grid layout and responsiveness.

## Fixes

- `components/AnalyticsDashboard.tsx`: fixed quota display duplication and improved error handling.
- `components/PerformancePanel.tsx`: fixed layout thrashing during resize.
- `src-tauri/src/pty.rs`: ensured robust IPC stream handling for high-throughput terminal output.

## Downloads

- macOS (Apple Silicon): `ggbond_0.3.0_aarch64.dmg`
- Windows (Intel/x64): `ggbond_0.3.0_x64-setup.exe`

Full Changelog: [`v0.2.19...v0.3.0`](https://github.com/Kevoyuan/GGBond/compare/v0.2.19...v0.3.0)

## GGBond v0.2.18

## Highlights

- Aligned chat/headless behavior to a **single `/api/chat` execution path** to avoid long-term drift.
- Removed route-level hardcoded model/approval overrides and delegated more model behavior to **gemini-cli-core**.
- Upgraded and aligned runtime integration with `@google/gemini-cli-core@0.31.0` behavior.
- Improved CoreService initialization and runtime settings handling for stability/performance.

## Core Alignment & Behavior

- `/api/chat/headless` now forwards request payloads without route-level default injection.
- Model handling now relies on core routing semantics instead of hardcoded active-model fallback chains.
- Chat settings normalization no longer strips unknown model IDs from persisted settings.
- Added/adjusted runtime initialization fields in CoreService for safer config parity.

## Performance & Reliability

- Reduced redundant work in chat/core session reinitialization paths.
- Added targeted caching/throttling in critical hot paths to lower repeated overhead.
- Preserved single source of truth for approval and mode behavior across entry routes.

## Versioning

- `package.json` / `package-lock.json`: `0.2.18`
- `src-tauri/tauri.conf.json`: `0.2.18`
- `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock`: `0.2.18`

## Downloads

- macOS (Apple Silicon): `ggbond_0.2.18_aarch64.dmg`

Full Changelog: [`v0.2.17...v0.2.18`](https://github.com/Kevoyuan/GGBond/compare/v0.2.17...v0.2.18)

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
