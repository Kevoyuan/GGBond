# Gemini CLI 助手

一个强大的基于Web的助手，利用Google的Gemini AI帮助用户通过对话界面与系统交互。此应用程序提供了一个基于聊天的UI，用户可以在其中询问有关系统的各种问题，运行命令并使用AI驱动的辅助功能管理各种任务。

## 功能特性

- **AI驱动的辅助功能**: 使用Google的Gemini AI模型进行智能回复
- **文件系统浏览器**: 浏览并与本地文件系统交互
- **命令执行**: 通过AI界面安全地运行系统命令
- **代码分析**: 获取关于您代码库的见解和解释
- **聊天界面**: 干净、响应式的UI，实现无缝对话
- **令牌使用跟踪**: 监控API使用情况和成本
- **工作区管理**: 组织和切换不同的工作区
- **设置面板**: 配置API密钥和首选项

## 技术栈

- **前端**: Next.js 14 带有 App Router
- **样式**: Tailwind CSS
- **UI组件**: shadcn/ui
- **AI集成**: Google Gemini API
- **数据库**: SQLite (通过Drizzle ORM)
- **类型安全**: TypeScript
- **测试**: Vitest

## 先决条件

- Node.js (版本18或更高)
- Google Gemini API密钥
- npm, yarn, pnpm 或 bun 包管理器

## 安装

1. 克隆仓库：
```bash
git clone <repository-url>
cd gemini-cli-assistant
```

2. 安装依赖项：
```bash
npm install
```

3. 设置环境变量：
```bash
cp .env.example .env.local
```

4. 将您的Google Gemini API密钥添加到 `.env.local`：
```
NEXT_PUBLIC_GEMINI_API_KEY=your_api_key_here
```

## 使用方法

1. 启动开发服务器：
```bash
npm run dev
```

2. 打开浏览器并导航至 [http://localhost:3000](http://localhost:3000)

3. 使用设置对话框配置您的设置（可通过标题栏访问）

4. 开始与AI助手聊天以执行任务，分析代码或浏览文件系统

## API文档

有关API端点的详细信息，请参阅：
- [gemini-cli-api.md](./gemini-cli-api.md) - 后端API文档
- [gemini-cli-ui-api.md](./gemini-cli-ui-api.md) - UI组件API文档

## 配置

可以通过环境变量和应用内设置面板配置应用程序：

- `NEXT_PUBLIC_GEMINI_API_KEY`: 您的Google Gemini API密钥
- 模型选择：在不同Gemini模型之间选择（pro, flash）
- 温度设置：调整AI响应随机性
- 工作区设置：定义默认工作区路径

## 贡献

我们欢迎贡献以增强Gemini CLI助手的功能和可用性。要贡献：

1. Fork仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交Pull Request

## 许可证

该项目根据MIT许可证授权 - 请参阅 [LICENSE](LICENSE) 文件了解详情。

## 支持

如果您遇到任何问题或有疑问，请在仓库中提交问题或查阅项目中包含的文档文件。