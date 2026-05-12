## Unreleased

### Highlights

- Upgraded `@google/gemini-cli-core` from `0.37.1` to `0.41.2` (latest stable release, May 6, 2026), skipping `0.42.x` preview/nightly builds.
- Refined the artifact panel with a denser header, file metadata, explicit Preview/Source segmented controls, dirty-state save affordance, source-file open action, and calmer message-level artifact entry point.
- Expanded the right-side workspace panel into a Workbench with Preview, Tasks, Plan, Terminal, Files, Graph, and Timeline tabs.

### Alignment Notes

- `package.json`, `package-lock.json`: Updated to `@google/gemini-cli-core@0.41.2`.
- `lib/core-service.ts`: Updated the memory file adapter to use `getMemoryContextManager()`, matching the newer core context split.
- `components/file/ArtifactPreview.tsx`, `components/chat/MessageBubble.tsx`: Improved artifact discoverability and editing ergonomics without changing artifact file APIs.
- `components/session/SidePanel.tsx`, `components/layout/Sidebar.tsx`, `components/terminal/TerminalPanel.tsx`, `lib/stores/ui-store.ts`, `app/HomePageClient.tsx`: Added the right Workbench tab router and reused existing terminal/files/insight surfaces inside it.

### Upstream Features Adopted

- v0.38.0: Core runtime inherits context compression improvements and persistent policy approval behavior where exposed by upstream internals.
- v0.39.0: Decoupled context manager reliability and memory leak fixes are adopted through the dependency bump.
- v0.40.0: MCP resource tools and updated memory management flow remain backend/core-mediated; GGBond does not add separate UI in this pass.
- v0.41.0-v0.41.2: Secure environment loading, shell validation hardening, and the v0.41.2 patch are adopted through core. Real-time voice mode remains an upstream capability with no GGBond UI change yet.

### Upstream Features Deferred Or Intentionally Divergent

- No dedicated GGBond UI was added for voice mode, MCP resource browsing, `/memory` inbox workflows, or upstream terminal-only narration features.
- GGBond intentionally keeps its existing product defaults and panel architecture while consuming core runtime fixes.

---

## GGBond v0.3.8

### Highlights

- Upgraded `@google/gemini-cli-core` from `0.35.2` to `0.37.1` (April 9, 2026), gaining two minor versions of upstream improvements including Chapters tool-based topic grouping, dynamic sandbox expansion, persistent browser sessions, forbiddenPaths sandbox controls, project-level memory scope, and reliability harvester with 500/503 retry support.
- Updated GGBond's scheduler adapter — the existing `Scheduler({ context: this.config, ... })` pattern remains fully compatible with the v0.37.x API surface. All core Config interface methods (`getMessageBus`, `getToolRegistry`, `getApprovalMode`, etc.) are preserved.
- Refreshed local alignment copy so Settings, Governance, and Agent auth surfaces now point at the `v0.37.1` baseline.

### Alignment Notes

- `package.json`, `package-lock.json`: Updated to `@google/gemini-cli-core@0.37.1`, aligning with the stable release published on April 9, 2026.
- `lib/core-service.ts`: No adapter changes required — the `AgentLoopContext` contract is still satisfied by `Config` via the existing `Scheduler({ context: this.config, ... })` pattern. All imported symbols (`Config`, `Scheduler`, `ROOT_SCHEDULER_ID`, `MessageBus`, `MessageBusType`, `ApprovalMode`, `ToolConfirmationOutcome`, `ToolErrorType`, `WriteTodosTool`, `createPolicyUpdater`, `createPolicyEngineConfig`, `resolveTelemetrySettings`, `Storage`) remain exported and signatures-compatible.
- TypeScript compilation (`tsc -p tsconfig.json --noEmit`): clean, zero errors.
- Sidecar build (`npm run build:sidecar`): succeeds with 58 auto-generated endpoints.

### Upstream Features Adopted

- Core API compatibility across v0.36.x and v0.37.x, including dynamic sandbox expansion (Linux/Windows), Chapters tool-based topic grouping, persistent browser sessions, `forbiddenPaths` sandbox configuration, reliability harvester with automatic 500/503 retry, project-level `save_memory` scope, and `memoryBoundaryMarkers` setting.
- All backend-only capabilities that land in core runtime internals (JIT context discovery, read-only tool auto-discovery, subagent context inheritance, snapshot reclamation) are available without UI changes.
- GGBond's existing `'code'` default mode is retained; upstream planning-first defaults remain intentionally diverged.

### Upstream Features Deferred Or Intentionally Divergent

- GGBond does not add dedicated UI for Chapters, forbiddenPaths sandbox controls, memoryBoundaryMarkers, or persistent browser sessions — those remain backend-only capabilities discoverable through core runtime.
- GGBond intentionally keeps `'code'` as the default mode instead of mirroring upstream planning-first defaults.

### Downloads

- macOS (Apple Silicon): `ggbond_0.3.8_aarch64.dmg` (pending build)
- Windows (Intel/x64): `ggbond_0.3.8_x64-setup.exe` (pending build)

Full Changelog: [`v0.3.7...v0.3.8`](https://github.com/Kevoyuan/GGBond/compare/v0.3.7...v0.3.8)

---

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
