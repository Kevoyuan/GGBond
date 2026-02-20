# GGBond

[English](./README.md) | [简体中文](./README.zh-CN.md)

<p align="center">
  <img src="./public/screenshot.png" alt="GGBond 截图" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/Kevoyuan/GGBond/releases">
    <img src="https://img.shields.io/github/v/release/Kevoyuan/GGBond?label=release" alt="最新版本" />
  </a>
  <a href="https://github.com/Kevoyuan/GGBond/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-green" alt="许可证" />
  </a>
  <img src="https://img.shields.io/badge/platform-macOS%20arm64-black" alt="平台" />
</p>

GGBond 是一个基于 Gemini CLI 的桌面级 AI 编程工作台。
它不是“套壳聊天框”，而是把真实开发流程里最关键的能力补全：工作区隔离、会话分支可视化、工具执行可追踪、会话可回放、桌面端稳定运行。

## 为什么是 GGBond（差异化）

- 工作区优先：每次对话都绑定到明确项目目录，避免上下文漂移。
- 分支可视化：对话图谱 + 时间线，不再丢失思路和备选方案。
- 工具可观测：看得到调用了什么、改了什么、哪里失败。
- Agent 友好：内置与自定义 Agent 都能按模型/模式明确运行。
- 桌面稳定性：本地服务兜底、单实例保护、SQLite 持久化增强。

## 核心能力

### 1) 可操作的 AI 对话
- 多轮编程会话，支持历史恢复与分支继续。
- 支持 `code / plan / ask` 等使用模式。
- 工具执行支持审批策略（安全模式与自动模式）。

### 2) 工作区 + 文件 + 终端一体化
- 快速添加/切换工作区。
- 内置文件树、文件查看与编辑能力。
- 集成终端面板，在当前工作区直接执行命令。

### 3) 对话过程可追踪
- Graph 视图看消息分支结构。
- Timeline 视图看逐步演进过程。
- 按消息/工具定位问题，降低 AI 黑盒感。

### 4) 可扩展运行时（MCP / Hooks / Skills）
- MCP 面板管理服务和扩展工具。
- Hooks 面板查看运行时事件。
- 可结合 Gemini CLI 的 Skills / Commands 体系扩展能力。

### 5) 面向发布的桌面工程能力
- 支持 macOS 签名与公证流程。
- 安装包体积优化，降低分发成本。
- 本地数据迁移与运行稳定性增强。

## 技术栈

| 模块 | 技术 |
|---|---|
| 桌面壳 | Electron 37 |
| 应用框架 | Next.js 16 (App Router) + React 19 |
| 语言 | TypeScript |
| 状态管理 | Zustand |
| AI 核心 | `@google/gemini-cli-core`, `@google/genai` |
| 数据存储 | `better-sqlite3` |
| 可视化 | `@xyflow/react` |
| UI/动画 | Tailwind CSS 4 + Framer Motion |

## 安装

从 [Releases](https://github.com/Kevoyuan/GGBond/releases) 下载最新版：

- `GGBond-x.x.x-arm64.dmg`（推荐）
- `GGBond-x.x.x-arm64-mac.zip`

## 3 分钟上手

1. 启动 GGBond。
2. 添加工作区（项目目录）。
3. 在 Chat 里输入明确任务。
4. 查看工具调用和文件变化。
5. 用 Graph/Timeline 从任意分支继续。

## 本地开发与构建

```bash
git clone https://github.com/Kevoyuan/GGBond.git
cd GGBond
npm install

# 桌面开发模式
npm run desktop:dev

# 构建 macOS 应用
npm run desktop:build:mac:release
```

签名与公证配置见：

- `docs/macos-release.md`

## 常见问题

### 打开应用后空白或无响应
- 先确认没有旧进程占用本地服务端口。
- 完全退出所有 GGBond 进程后重开。

### 能添加工作区但看不到文件
- 优先使用系统目录选择器授权目录。
- 在 macOS 隐私设置中补充文件访问权限（必要时 Full Disk Access）。

### Chat 出现 “Error processing request”
- 常见原因是旧实例冲突或本地状态异常。
- 完全退出应用后重启，再重试会话。

## 项目结构

```text
GGBond/
├── app/                 # Next.js 页面与 API 路由
├── components/          # UI 组件（聊天、侧栏、图谱等）
├── electron/            # 桌面主进程与 preload
├── lib/                 # 核心服务（Gemini 桥接、DB、运行时）
├── stores/              # Zustand 状态
├── scripts/             # 构建/发布辅助脚本
└── docs/                # 发布与维护文档
```

## 贡献

欢迎提 Issue 和 PR。建议在 PR 中明确：

- 改了什么
- 为什么改
- 如何验证

## 许可证

MIT

---

<p align="center">由 <a href="https://github.com/Kevoyuan">Kevoyuan</a> 开发</p>
