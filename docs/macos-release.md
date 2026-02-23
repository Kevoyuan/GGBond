# macOS Release (Tauri 2)

本项目已经迁移到 Tauri。要避免用户安装后出现“已损坏，无法打开”，必须在发布阶段完成 **Developer ID 签名 + Apple Notarization**。

## 1) 一次性配置（GitHub Secrets）

在 GitHub 仓库 `Settings -> Secrets and variables -> Actions` 配置以下密钥：

必需（macOS 签名）：
- `APPLE_CERTIFICATE`: `Developer ID Application` 证书导出的 `.p12` 文件 base64
- `APPLE_CERTIFICATE_PASSWORD`: `.p12` 导出密码

推荐（Notary API Key 模式）：
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`
- `APPLE_API_KEY_BASE64`: `AuthKey_XXXXXX.p8` 的 base64

可选（Apple ID 模式，作为备用）：
- `APPLE_ID`
- `APPLE_PASSWORD`（app-specific password）
- `APPLE_TEAM_ID`

## 2) 自动发布流程

仓库已提供流水线：
- `.github/workflows/release-tauri.yml`

触发方式：
1. 更新版本号（`package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`）
2. 打 tag 并 push

```bash
git tag v0.2.6
git push origin v0.2.6
```

流水线将自动：
- 构建 macOS（aarch64）安装包
- 构建 Windows 安装包
- 上传到 GitHub Release
- 在配置好 Apple 凭据时完成 macOS 公证

## 3) 发布后验证（macOS）

下载 DMG 后可本地验证：

```bash
spctl -a -vv "/Applications/ggbond.app"
codesign -dv --verbose=4 "/Applications/ggbond.app"
```

如果公证正确，用户不需要再手动执行 `xattr -dr com.apple.quarantine ...`。

## 4) 常见问题

- 仍提示“已损坏”
  - 说明发布产物未完成签名/公证，或用户安装的是非官方构建。
- 本地 `npm run tauri dev` 正常但安装包失败
  - `dev` 不走签名与公证链路；只有 release 包需要这一步。
