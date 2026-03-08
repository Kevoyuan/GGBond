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
