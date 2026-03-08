## GGBond v0.3.4

## Highlights

- Fixed quota fetch to work even when CoreService is not initialized.
- Improved Rust dependency updates.

## Fixes

- `app/api/quota/route.ts`: Fetch quota using a temporary lightweight Config when CoreService.config is not available, instead of returning null. This improves quota display availability without triggering full CoreService initialization.
- Includes auth fallback logic to try alternative auth types if the preferred one fails.

## Downloads

- macOS (Apple Silicon): `ggbond_0.3.4_aarch64.dmg`
- Windows (Intel/x64): `ggbond_0.3.4_x64-setup.exe`

Full Changelog: [`v0.3.3...v0.3.4`](https://github.com/Kevoyuan/GGBond/compare/v0.3.3...v0.3.4)
