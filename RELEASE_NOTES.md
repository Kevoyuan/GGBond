## GGBond v0.3.6

### Highlights

- Upgraded `@google/gemini-cli-core` from `0.33.0` to `0.34.0`.
- Added AbortError graceful handling for ESC cancellation during streaming and tool execution.
- Removed deprecated `requiresAgentCardAuth` field — upstream v0.34.0 removed the `agent_card_requires_auth` config flag.
- Added local persistence and display support for per-model token usage when Gemini CLI returns multi-model usage data.
- GGBond intentionally keeps `'code'` as the default mode (upstream v0.34.0 defaults to `'plan'`; GGBond is a code-first assistant).

### Alignment Notes

- `package.json`, `package-lock.json`: Updated to `@google/gemini-cli-core@0.34.0` to align with the stable release published on March 17, 2026.
- `lib/core-service.ts`: Added `isAbortError` utility. Added AbortError guards in stream processing (`sendMessageStream` catch), turn loop catch, and `executeToolCalls` scheduler catch. Prevents unhandled crashes when users press ESC to cancel streaming or tool execution.
- `legacy-api/agents/route.ts`: Removed `agent_card_requires_auth` from `AgentAuthConfig` type and `AgentAuthSummary` type. Updated `summarizeAuth()` to no longer emit the field. Upstream removed the config flag in [#21914](https://github.com/google-gemini/gemini-cli/pull/21914).
- `legacy-api/chat/route.ts`, `legacy-api/stats/route.ts`, `legacy-api/sessions/latest-stats/route.ts`, `legacy-api/telemetry/route.ts`, `legacy-api/analytics/nerd-stats/route.ts`: Normalized token stats parsing and preserved per-model token usage from stream-json finish events so storage and analytics stay compatible with both old and new core payloads.
- `components/TokenUsageDisplay.tsx`: Added a per-model usage breakdown when a turn spans multiple models.
- `components/AgentPanel.tsx`: Removed `requiresAgentCardAuth` from `AgentDefinition` type and the "Auth required" badge rendering. Removed unused `Lock` import.
- `components/AgentPreviewDialog.tsx`: Removed `requiresAgentCardAuth` from type and the "Agent card requires auth" badge. Removed unused `Lock` import.
- `stores/useAppStore.ts`: Removed `requiresAgentCardAuth` from the `Agent` interface.
- `components/SettingsDialog.tsx`: Updated the Gemini CLI alignment section to reflect the current `v0.34.0` baseline instead of `v0.33.0`.

### Upstream Features Adopted

- AbortError resilience for stream cancellation, tool interruption, and processTurn.
- Per-model token usage in stream-json output.
- OOM fixes for long-running sessions (ChatRecordingService in-memory cache).

### Upstream Features Deferred Or Intentionally Divergent

- Plan Mode enabled by default in upstream `v0.34.0`, but GGBond intentionally keeps `'code'` as the default mode.
- MCP `mcp_` FQN naming, policy auto-add persistence, plan-mode flash steering, and approved-plan compression behavior currently rely on upstream core behavior and are not yet exposed or validated as distinct GGBond UI features in this release.

### Downloads

- macOS (Apple Silicon): `ggbond_0.3.6_aarch64.dmg`
- Windows (Intel/x64): `ggbond_0.3.6_x64-setup.exe`

Full Changelog: [`v0.3.5...v0.3.6`](https://github.com/Kevoyuan/GGBond/compare/v0.3.5...v0.3.6)
