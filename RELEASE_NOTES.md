## GGBond v0.3.7

### Highlights

- Upgraded `@google/gemini-cli-core` from `0.34.0` to `0.35.2`.
- Updated GGBond's scheduler adapter to match the newer `AgentLoopContext`-based `SchedulerOptions` contract used by Gemini CLI Core `v0.35.2`.
- Refreshed local alignment copy so Settings, Governance, and Agent auth surfaces now point at the `v0.35.2` baseline.
- Added a dedicated keyboard shortcuts manager in Settings, including table editing, shortcut recording, starter bindings, advanced JSON editing, and duplicate shortcut conflict detection.
- GGBond intentionally keeps `'code'` as the default mode even though upstream still defaults the product toward planning-oriented workflows.

### Alignment Notes

- `package.json`, `package-lock.json`: Updated to `@google/gemini-cli-core@0.35.2`, aligning with the stable release published on March 26, 2026.
- `lib/core-service.ts`: Switched `new Scheduler(...)` from the old `config` option to the new `context` option because `SchedulerOptions` now expects an `AgentLoopContext`. `Config` already implements that contract, so the adapter stays thin and native-compatible.
- `components/settings/SettingsDialog.tsx`: Updated the visible Gemini CLI alignment section to `v0.35.2`, and added a keyboard shortcuts manager backed by Gemini CLI's `keybindings.json` with row editing, key recording, starter bindings, advanced JSON editing, and save-time conflict prevention.
- `legacy-api/keybindings/route.ts`, `lib/gemini-service.ts`: Added read/write support for Gemini CLI user keybindings so the new Settings UI can manage shortcuts through a dedicated API.
- `components/agent/AgentPreviewDialog.tsx`: Updated the agent-auth helper text to the new `v0.35.2` baseline.
- `components/dialogs/ModulesDialog.tsx`: Updated the Governance module description to the current core version.

### Upstream Features Adopted

- Core API compatibility for the scheduler refactor that landed between `v0.34.0` and `v0.35.2`.
- Dependency-level access to upstream `v0.35.x` improvements, including keyboard customization, Vim-mode polish, sandbox/tool-isolation work, and JIT context discovery where those behaviors are already mediated by core runtime internals.
- A first-class GGBond UI for upstream keyboard customization, exposed through Settings instead of requiring users to hand-edit `~/.gemini/keybindings.json`.

### Upstream Features Deferred Or Intentionally Divergent

- GGBond now exposes keyboard customization, but still does not add dedicated UI for sandbox controls or JIT context discovery; those remain backend-only/core-mediated capabilities for now.
- GGBond intentionally keeps `'code'` as the default mode instead of mirroring upstream planning-first defaults.

### Downloads

- macOS (Apple Silicon): `ggbond_0.3.7_aarch64.dmg`
- Windows (Intel/x64): `ggbond_0.3.6_x64-setup.exe`

Full Changelog: [`v0.3.6...v0.3.7`](https://github.com/Kevoyuan/GGBond/compare/v0.3.6...v0.3.7)
