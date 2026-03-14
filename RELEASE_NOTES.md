## GGBond v0.3.5

## Highlights

- Upgraded `@google/gemini-cli-core` from `0.32.1` to `0.33.0`.
- Exposed Gemini CLI v0.33.0 remote-agent authentication state in the agent UI.
- Added plan-review feedback so users can request a revised plan instead of only cancelling.
- Added Gemini CLI settings for 30-day session retention and experimental agent enablement.

## Alignment Notes

- `package.json`, `package-lock.json`: Updated to `@google/gemini-cli-core@0.33.0` to align with the stable release published on March 11, 2026.
- `app/api/agents/route.ts`: Switched agent frontmatter parsing to YAML-aware parsing so remote A2A agent auth metadata is preserved and returned to the UI.
- `components/AgentPanel.tsx`, `components/AgentPreviewDialog.tsx`: Added remote-agent badges for auth-required and configured-auth states, including HTTP/API key summaries and agent-card visibility.
- `components/ConfirmationDialog.tsx`, `app/HomePageClient.tsx`: Added feedback submission for `exit_plan_mode`, mapping plan rejection comments into Gemini CLI's confirmation payload so plans can iterate in-place.
- `components/SettingsDialog.tsx`: Added Gemini CLI v0.33.0 settings for `general.sessionRetention` and `experimental.enableAgents`.
- `components/ModulesDialog.tsx`: Updated governance copy to reflect the new v0.33 alignment.

## Upstream Features Adopted

- Authenticated A2A agent-card discovery and HTTP authentication support for remote agents.
- Plan Mode review iteration via feedback-backed rejection flow.
- 30-day default session retention surfaced as an explicit configurable setting.

## Downloads

- macOS (Apple Silicon): `ggbond_0.3.5_aarch64.dmg`
- Windows (Intel/x64): `ggbond_0.3.5_x64-setup.exe`

Full Changelog: [`v0.3.4...v0.3.5`](https://github.com/Kevoyuan/GGBond/compare/v0.3.4...v0.3.5)
