## GGBond v0.3.3

## Highlights

- Upgraded `@google/gemini-cli-core` from `0.32.0` to `0.32.1`.
- Added API caching with in-flight request deduplication to improve first-screen load time.
- Improved frontend performance by delaying non-critical API fetches.
- Enhanced skills UX with better command handling and filtering.
- Added expand/collapse for long session lists in sidebar.
- Improved skill/agent badge styling and positioning.

## Gemini CLI Core v0.32.1 Alignment

- Updated the core dependency to the latest stable npm release, published on 2026-03-04.
- Reviewed the post-`0.32.0` upstream release/changelog/docs delta before upgrading.
- Found no new stable `Config`, `MessageBus`, approval, or stream-contract changes that require adapter edits in `lib/core-service.ts` or `app/api/chat/route.ts`.
- Preserved current `0.32.0` integration behavior and avoided mixing preview-only upstream features into the stable sync.

## Performance Improvements

- Added 10s TTL cache + in-flight dedup to `/api/agents`, `/api/models`, `/api/governance/steering` routes.
- Skip CoreService initialization on `/api/quota` cold start to avoid blocking.
- Added 3s delay to steering fetch in ChatContainer, 2s delay to models fetch in ModelSelector.
- Show fallback data immediately while background fetches complete.

## UI/UX Enhancements

- Skills: Filter to show only enabled skills in command palette.
- Skills: Improved skill command matching (match against ID and description).
- Sidebar: Show only first 10 sessions per workspace by default, with expand button.
- Chat: Improved skill/agent badge styling using outline instead of border.
- Config: Increased default window size to 1440x900, adjusted traffic light position.

## Fixes

- Safe null checks for agent registry in API routes.
- Fixed CSS to use bg-primary color instead of transparent for body background.

## Downloads

- macOS (Apple Silicon): `ggbond_0.3.3_aarch64.dmg`
- Windows (Intel/x64): `ggbond_0.3.3_x64-setup.exe`

Full Changelog: [`v0.3.2...v0.3.3`](https://github.com/Kevoyuan/GGBond/compare/v0.3.2...v0.3.3)

## GGBond v0.3.2

## Highlights

- Aligned the app with `@google/gemini-cli-core@0.32.0`.
- Added workspace-scoped model steering in the governance panel.
- Improved plan-mode approval flow and interactive shell behavior.

## Gemini CLI Core v0.32.0 Alignment

- Upgraded `@google/gemini-cli-core` to `0.32.0`.
- Added workspace-level model/profile overrides via the new governance steering API and UI.
- Improved plan mode handling:
  - external editor support for plan review
  - better multi-select question handling
- Added interactive shell autocompletion plumbing for terminal sessions.
- Parallelized extension command loading to reduce startup and discovery overhead.

## Downloads

- macOS (Apple Silicon): `ggbond_0.3.2_aarch64.dmg`
- Windows (Intel/x64): `ggbond_0.3.2_x64-setup.exe`

Full Changelog: [`v0.3.1...v0.3.2`](https://github.com/Kevoyuan/GGBond/compare/v0.3.1...v0.3.2)

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
