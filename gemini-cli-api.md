# Gemini CLI GUI 开发说明书

---

## 第一部分：完整 API 参考

---

### 1. CLI 启动参数

```bash
# 基础启动
gemini                                    # 交互模式
gemini -p "prompt"                        # 非交互模式（单次提问）
gemini -p "prompt" --output-format json   # JSON 输出
gemini -p "prompt" --output-format stream-json  # 流式 JSON

# 模型选择
gemini -m gemini-2.5-pro
gemini -m gemini-3-flash-preview
gemini --model gemini-2.5-flash-lite

# 目录配置
gemini --include-directories ../lib,../docs

# 调试
gemini --debug
```

---

### 2. Slash 命令 (/)

#### 会话管理
```bash
/chat save <tag>           # 保存对话检查点
/chat list                 # 列出所有检查点
/chat resume <tag>         # 恢复检查点
/chat delete <tag>         # 删除检查点
/chat share [filename]     # 导出为 Markdown/JSON

/resume                    # 浏览历史会话
/rewind                    # 回退对话历史
/restore [tool_call_id]    # 恢复到工具执行前状态
/compress                  # 压缩上下文生成摘要
/clear                     # 清屏 (Ctrl+L)
/copy                      # 复制最后输出
```

#### 工具与 MCP
```bash
/tools                     # 列出可用工具
/tools desc                # 显示工具详细描述
/tools nodesc              # 只显示工具名

/mcp                       # 列出 MCP 服务器
/mcp list                  # 同上
/mcp desc                  # 显示详细描述
/mcp schema                # 显示工具 schema
/mcp refresh               # 重启所有服务器
/mcp auth <server>         # OAuth 认证
```

#### 技能与扩展
```bash
/skills                    # 列出技能
/skills list               # 同上
/skills enable <name>      # 启用技能
/skills disable <name>     # 禁用技能
/skills reload             # 重新加载

/extensions                # 列出活动扩展
```

#### 上下文与内存
```bash
/memory                    # 内存管理
/memory show               # 显示完整上下文
/memory list               # 列出 GEMINI.md 路径
/memory add <text>         # 添加到内存
/memory refresh            # 重新加载

/init                      # 自动生成 GEMINI.md

/directory show            # 显示工作目录
/directory add <path>      # 添加目录
/dir add ../lib,~/docs     # 支持多路径
```

#### 配置与设置
```bash
/settings                  # 打开设置编辑器
/model                     # 模型选择对话框
/theme                     # 主题选择
/auth                      # 认证设置
/editor                    # 编辑器选择
/privacy                   # 隐私设置
/vim                       # 切换 Vim 模式
```

#### Hooks 管理
```bash
/hooks                     # Hook 管理
/hooks list                # 列出所有 hooks
/hooks enable <name>       # 启用
/hooks disable <name>      # 禁用
/hooks enable-all          # 全部启用
/hooks disable-all         # 全部禁用
```

#### 其他
```bash
/stats                     # 显示 Token 统计
/about                     # 版本信息
/help                      # 帮助
/docs                      # 打开文档
/bug                       # 报告问题
/shortcuts                 # 快捷键面板
/shells                    # 后台 shell 视图
/introspect                # 调试信息
/policies list             # 列出策略
/quit                      # 退出 (/exit)
```

---

### 3. 文件引用命令 (@)

```bash
@path/to/file.ts           # 引用单个文件
@src/                      # 引用目录
@**/*.ts                   # Glob 模式
@image.png                 # 引用图片
@document.pdf              # 引用 PDF
```

---

### 4. Shell 命令 (!)

```bash
!ls -la                    # 执行单个命令
!npm run build             # 执行构建
!                          # 进入 Shell 模式（再按 ! 退出）
```

---

### 5. 扩展管理命令

```bash
gemini extensions install <url|path>    # 安装扩展
gemini extensions uninstall <name>      # 卸载
gemini extensions list                  # 列出已安装

gemini mcp add <name> --command "cmd"   # 添加 MCP 服务器
gemini mcp remove <name>                # 删除
gemini mcp enable <name>                # 启用
gemini mcp disable <name>               # 禁用
```

---

### 6. 内置工具 API

#### 6.1 list_directory (ReadFolder)
```javascript
list_directory({
  path: string,              // 必需：绝对路径
  ignore?: string[],         // 可选：忽略模式 ["*.log", ".git"]
  respect_git_ignore?: boolean  // 可选：遵循 .gitignore，默认 true
})
// 返回：目录列表字符串
// 确认：否
```

#### 6.2 read_file (ReadFile)
```javascript
read_file({
  path: string,              // 必需：绝对路径
  offset?: number,           // 可选：起始行号（0-based）
  limit?: number             // 可选：读取行数
})
// 支持：文本、PNG/JPG/GIF/WEBP/SVG/BMP、MP3/WAV/AIFF/AAC/OGG/FLAC、PDF
// 返回：文件内容或 base64 数据
// 确认：否
```

#### 6.3 write_file (WriteFile)
```javascript
write_file({
  file_path: string,         // 必需：绝对路径
  content: string            // 必需：文件内容
})
// 返回：成功消息
// 确认：是（显示 diff）
```

#### 6.4 glob (FindFiles)
```javascript
glob({
  pattern: string,           // 必需：glob 模式 "**/*.ts"
  path?: string,             // 可选：搜索目录
  case_sensitive?: boolean,  // 可选：大小写敏感，默认 false
  respect_git_ignore?: boolean  // 可选：默认 true
})
// 返回：按修改时间排序的文件路径列表
// 确认：否
```

#### 6.5 grep_search (SearchText)
```javascript
grep_search({
  pattern: string,           // 必需：正则表达式
  path?: string,             // 可选：搜索目录
  include?: string           // 可选：文件过滤 "*.ts"
})
// 返回：匹配行 + 文件路径 + 行号
// 确认：否
```

#### 6.6 replace (Edit)
```javascript
replace({
  file_path: string,         // 必需：绝对路径
  old_string: string,        // 必需：要替换的文本（含3行上下文）
  new_string: string,        // 必需：替换后的文本
  expected_replacements?: number  // 可选：替换次数，默认 1
})
// 返回：成功/失败消息
// 确认：是（显示 diff）
```

#### 6.7 run_shell_command (Shell)
```javascript
run_shell_command({
  command: string,           // 必需：shell 命令
  description?: string,      // 可选：命令描述
  directory?: string         // 可选：执行目录（相对项目根）
})
// 返回：{ stdout, stderr, exitCode, signal, backgroundPIDs }
// 确认：是
// 环境变量：GEMINI_CLI=1
```

#### 6.8 google_web_search (GoogleSearch)
```javascript
google_web_search({
  query: string              // 必需：搜索查询
})
// 返回：搜索结果摘要
// 确认：否
```

#### 6.9 web_fetch (WebFetch)
```javascript
web_fetch({
  url: string                // 必需：URL
})
// 返回：网页内容
// 确认：否
```

#### 6.10 save_memory (SaveMemory)
```javascript
save_memory({
  content: string            // 必需：要保存的内容
})
// 返回：确认消息
// 确认：否
```

#### 6.11 write_todos (WriteTodos)
```javascript
write_todos({
  todos: string[]            // 必需：待办事项列表
})
// 返回：确认消息
// 确认：否
```

---

### 7. settings.json 完整配置

#### 7.1 general（通用）
```json
{
  "general": {
    "preferredEditor": "code",           // 首选编辑器
    "vimMode": false,                    // Vim 模式
    "enableAutoUpdate": true,            // 自动更新
    "enableAutoUpdateNotification": true,
    "retryFetchErrors": false,
    "debugKeystrokeLogging": false,
    
    "checkpointing": {
      "enabled": false                   // 会话检查点（需重启）
    },
    
    "enablePromptCompletion": false,     // AI 提示补全（需重启）
    
    "sessionRetention": {
      "enabled": false,
      "maxAge": "30d",                   // 最大保留时间
      "maxCount": 100,                   // 最大会话数
      "minRetention": "1d"               // 最小保留期
    }
  }
}
```

#### 7.2 model（模型）
```json
{
  "model": {
    "name": "gemini-2.5-pro",            // 默认模型
    "maxSessionTurns": -1,               // 最大轮次（-1=无限）
    "compressionThreshold": 0.5,         // 上下文压缩阈值
    "disableLoopDetection": false,       // 禁用循环检测
    "skipNextSpeakerCheck": true,
    
    "summarizeToolOutput": {
      "run_shell_command": {
        "tokenBudget": 2000              // Shell 输出 token 预算
      }
    }
  }
}
```

#### 7.3 modelConfigs（模型配置）
```json
{
  "modelConfigs": {
    "customAliases": {
      "my-custom": {
        "extends": "chat-base",
        "modelConfig": {
          "model": "gemini-2.5-flash",
          "generateContentConfig": {
            "temperature": 0.7,
            "topP": 0.9,
            "topK": 40,
            "maxOutputTokens": 8192,
            "thinkingConfig": {
              "thinkingBudget": 4096,
              "thinkingLevel": "HIGH",    // Gemini 3
              "includeThoughts": true
            }
          }
        }
      }
    },
    "customOverrides": [],
    "overrides": []
  }
}
```

**内置别名**：
- `gemini-3-pro-preview`, `gemini-3-flash-preview`
- `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`
- `web-search`, `web-fetch`, `classifier`, `prompt-completion`

#### 7.4 tools（工具）
```json
{
  "tools": {
    "sandbox": "docker",                 // true/false/"docker"/路径
    "approvalMode": "default",           // "default"|"auto_edit"|"plan"
    
    "core": [                            // 白名单
      "read_file",
      "run_shell_command(git)",
      "run_shell_command(npm test)"
    ],
    
    "exclude": [                         // 黑名单
      "write_file",
      "run_shell_command(rm)"
    ],
    
    "allowed": [                         // 跳过确认
      "run_shell_command(git status)"
    ],
    
    "discoveryCommand": "bin/get_tools", // 自定义工具发现
    "callCommand": "bin/call_tool",      // 自定义工具调用
    "useRipgrep": true,
    "truncateToolOutputThreshold": 40000,
    "disableLLMCorrection": true,
    
    "shell": {
      "enableInteractiveShell": true,
      "showColor": false,
      "pager": "cat",
      "inactivityTimeout": 300          // 秒
    }
  }
}
```

#### 7.5 mcpServers（MCP 服务器）
```json
{
  "mcpServers": {
    "server-name": {
      "command": "uvx",                  // stdio 命令
      "args": ["mcp-server-git"],
      "cwd": "/project/root",
      "env": {
        "TOKEN": "$ENV_TOKEN"
      },
      "url": "http://localhost:3001/sse", // SSE 传输
      "httpUrl": "https://api.example.com/mcp/", // HTTP 传输
      "headers": {
        "Authorization": "Bearer $TOKEN"
      },
      "timeout": 5000,
      "trust": false,                    // 跳过所有确认
      "description": "Server description",
      "includeTools": ["tool1", "tool2"], // 工具白名单
      "excludeTools": ["tool3"]          // 工具黑名单（优先级更高）
    }
  },
  
  "mcp": {
    "serverCommand": "custom-mcp",
    "allowed": ["server1", "server2"],
    "excluded": ["risky-server"]
  }
}
```

#### 7.6 context（上下文）
```json
{
  "context": {
    "fileName": ["GEMINI.md", "CONTEXT.md"],  // 支持多文件
    "importFormat": "markdown",
    "discoveryMaxDirs": 200,
    "includeDirectories": ["../lib", "~/docs"],
    "loadMemoryFromIncludeDirectories": false,
    
    "fileFiltering": {
      "respectGitIgnore": true,
      "respectGeminiIgnore": true,
      "enableRecursiveFileSearch": true,
      "enableFuzzySearch": true,
      "customIgnoreFilePaths": [".myignore"]
    }
  }
}
```

#### 7.7 skills（技能）
```json
{
  "skills": {
    "enabled": true,
    "disabled": ["skill-name-1", "skill-name-2"]
  }
}
```

#### 7.8 hooks（钩子）
```json
{
  "hooksConfig": {
    "enabled": true,
    "disabled": ["hook-name"],
    "notifications": true
  },
  
  "hooks": {
    "BeforeTool": [{"command": "echo $TOOL_NAME", "timeout": 5000}],
    "AfterTool": [],
    "BeforeAgent": [],
    "AfterAgent": [],
    "Notification": [],
    "SessionStart": [],
    "SessionEnd": [],
    "PreCompress": [],
    "BeforeModel": [],
    "AfterModel": [],
    "BeforeToolSelection": []
  }
}
```

#### 7.9 security（安全）
```json
{
  "security": {
    "disableYoloMode": false,
    "enablePermanentToolApproval": false,
    "blockGitExtensions": false,
    "allowedExtensions": ["^https://github.com/google-gemini/.*"],
    
    "auth": {
      "selectedType": "gemini-api-key",  // "oauth"|"vertex-ai"
      "enforcedType": null,
      "useExternal": false
    },
    
    "folderTrust": {
      "enabled": true
    },
    
    "environmentVariableRedaction": {
      "enabled": true,
      "allowed": ["PATH", "HOME"],
      "blocked": ["*TOKEN*", "*SECRET*", "*PASSWORD*"]
    }
  }
}
```

#### 7.10 ui（界面）
```json
{
  "ui": {
    "theme": "GitHub",
    "autoThemeSwitching": true,
    "terminalBackgroundPollingInterval": 60,
    
    "hideBanner": false,
    "hideTips": false,
    "hideContextSummary": false,
    "hideFooter": false,
    "hideWindowTitle": false,
    
    "footer": {
      "hideCWD": false,
      "hideSandboxStatus": false,
      "hideModelInfo": false,
      "hideContextPercentage": false
    },
    
    "showLineNumbers": true,
    "showCitations": false,
    "showModelInfoInChat": false,
    "showMemoryUsage": false,
    "showSpinner": true,
    "showStatusInTitle": false,
    "dynamicWindowTitle": true,
    "showHomeDirectoryWarning": true,
    "showUserIdentity": true,
    
    "useAlternateBuffer": false,
    "useBackgroundColor": true,
    "incrementalRendering": true,
    
    "customWittyPhrases": ["Loading..."],
    "customThemes": {},
    
    "accessibility": {
      "enableLoadingPhrases": true,
      "screenReader": false
    }
  }
}
```

#### 7.11 telemetry（遥测）
```json
{
  "telemetry": {
    "enabled": true,
    "target": "local",                   // "local"|"gcp"
    "otlpEndpoint": "http://localhost:4317",
    "otlpProtocol": "grpc",              // "grpc"|"http"
    "logPrompts": true,
    "outfile": "~/.gemini/telemetry.log",
    "useCollector": false
  },
  
  "privacy": {
    "usageStatisticsEnabled": true
  }
}
```

#### 7.12 admin（管理员）
```json
{
  "admin": {
    "secureModeEnabled": false,
    "extensions": { "enabled": true },
    "mcp": { "enabled": true, "config": {} },
    "skills": { "enabled": true }
  }
}
```

#### 7.13 agents（代理）
```json
{
  "agents": {
    "overrides": {}                      // 特定代理的覆盖设置
  }
}
```

#### 7.14 experimental（实验性）
```json
{
  "experimental": {
    "enableAgents": false,               // 子代理（使用 YOLO 模式）
    "extensionManagement": true,
    "extensionConfig": true,
    "extensionReloading": false,
    "jitContext": false,                 // JIT 上下文加载
    "useOSC52Paste": false,              // 远程会话粘贴
    "plan": false                        // 计划模式
  }
}
```

#### 7.15 advanced（高级）
```json
{
  "advanced": {
    "autoConfigureMemory": false,
    "dnsResolutionOrder": null,
    "excludedEnvVars": ["DEBUG", "DEBUG_MODE"],
    "bugCommand": {}
  },
  
  "output": {
    "format": "text"                     // "text"|"json"
  },
  
  "ide": {
    "enabled": false,
    "hasSeenNudge": false
  },
  
  "useWriteTodos": true
}
```

---

### 8. 环境变量

```bash
# 认证
export GEMINI_API_KEY="your-api-key"
export GOOGLE_API_KEY="your-google-key"
export GOOGLE_CLOUD_PROJECT="project-id"
export GOOGLE_GENAI_USE_VERTEXAI=true

# 配置
export GEMINI_MODEL="gemini-2.5-pro"
export GEMINI_CLI_HOME="/custom/path"     # 配置目录

# 系统配置路径覆盖
export GEMINI_CLI_SYSTEM_DEFAULTS_PATH="/path"
export GEMINI_CLI_SYSTEM_SETTINGS_PATH="/path"
```

---

### 9. 配置文件位置

| 文件 | 位置 | 优先级 |
|------|------|--------|
| 系统默认 | `/etc/gemini-cli/system-defaults.json` (Linux)<br>`C:\ProgramData\gemini-cli\system-defaults.json` (Win)<br>`/Library/Application Support/GeminiCli/system-defaults.json` (Mac) | 1 (最低) |
| 用户设置 | `~/.gemini/settings.json` | 2 |
| 项目设置 | `.gemini/settings.json` | 3 |
| 系统覆盖 | `/etc/gemini-cli/settings.json` | 4 |
| 环境变量 | `.env` 文件或 shell | 5 |
| CLI 参数 | 命令行 | 6 (最高) |

---

### 10. 扩展文件结构

```
~/.gemini/
├── settings.json              # 用户设置
├── commands/                  # 自定义命令
│   └── deploy.toml
├── skills/                    # 用户技能
├── extensions/                # 已安装扩展
│   └── cloud-run/
│       ├── gemini-extension.json
│       ├── GEMINI.md
│       └── commands/
└── tmp/                       # 临时文件
    └── <project_hash>/
        ├── shell_history
        └── checkpoints/

.gemini/                       # 项目级
├── settings.json
├── GEMINI.md
├── commands/
├── skills/
└── sandbox.Dockerfile
```

---

### 11. 自定义命令格式 (TOML)

```toml
# ~/.gemini/commands/deploy.toml
[command]
name = "deploy"
description = "Deploy to Cloud Run"

[command.arguments]
project = { type = "string", required = true, description = "GCP Project ID" }
location = { type = "string", required = false, default = "us-central1" }
name = { type = "string", required = true }

[command.prompt]
template = """
Deploy the current project to Google Cloud Run.
Project: {{project}}
Location: {{location}}
Service Name: {{name}}
"""
```

---

### 12. 扩展清单格式 (gemini-extension.json)

```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "description": "Extension description",
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["@my/mcp-server"]
    }
  },
  "commands": [
    { "name": "my-cmd", "file": "commands/my-cmd.toml" }
  ],
  "context": ["GEMINI.md"]
}
```

---

## 第二部分：15 个最值得投入的核心模块

---

### 模块 1：Token 使用监控仪表盘 ⭐⭐⭐⭐⭐

**功能**：实时显示 Token 消耗、配额、缓存命中率

**数据来源**：
```bash
/stats                         # 获取统计数据
```

**相关配置**：
```json
{
  "ui.footer.hideContextPercentage": false,
  "ui.showMemoryUsage": true,
  "model.compressionThreshold": 0.5
}
```

**关键指标**：
- Input/Output/Cached Tokens
- Context Window 使用率 (X / 1,000,000)
- 日配额 (X / 1,000 请求)
- 分钟速率 (X / 60 RPM)

---

### 模块 2：MCP Server 管理器 ⭐⭐⭐⭐⭐

**功能**：可视化管理 MCP 服务器连接、工具发现

**API**：
```bash
/mcp list                      # 服务器状态
/mcp desc                      # 工具描述
/mcp schema                    # 工具 schema
/mcp refresh                   # 重启服务器
/mcp auth <server>             # OAuth

gemini mcp add <name> ...      # 添加服务器
gemini mcp remove <name>       # 删除
gemini mcp enable/disable      # 启用/禁用
```

**配置结构**：
```json
"mcpServers": {
  "<name>": {
    "command": "", "args": [], "env": {},
    "url": "", "httpUrl": "", "headers": {},
    "timeout": 5000, "trust": false,
    "includeTools": [], "excludeTools": []
  }
}
```

---

### 模块 3：对话 Checkpointing 时间线 ⭐⭐⭐⭐⭐

**功能**：保存/恢复/分支对话状态

**API**：
```bash
/chat save <tag>               # 保存
/chat list                     # 列出
/chat resume <tag>             # 恢复
/chat delete <tag>             # 删除
/chat share [file]             # 导出

/rewind                        # 回退历史
/restore [tool_call_id]        # 恢复到工具执行前
/resume                        # 浏览历史会话
```

**配置**：
```json
"general.checkpointing.enabled": true
```

**存储位置**：`~/.gemini/tmp/<project_hash>/`

---

### 模块 4：模型选择器 ⭐⭐⭐⭐⭐

**功能**：切换模型、配置参数、自定义别名

**API**：
```bash
/model                         # 模型对话框
gemini -m <model>              # CLI 参数
```

**配置**：
```json
"model.name": "gemini-2.5-pro",
"modelConfigs.customAliases": {
  "my-alias": {
    "extends": "chat-base",
    "modelConfig": {
      "model": "gemini-2.5-flash",
      "generateContentConfig": {
        "temperature": 0.7,
        "topP": 0.9,
        "topK": 40,
        "maxOutputTokens": 8192,
        "thinkingConfig": {
          "thinkingBudget": 4096
        }
      }
    }
  }
}
```

**可用模型**：
- `gemini-3-pro-preview` / `gemini-3-flash-preview`
- `gemini-2.5-pro` / `gemini-2.5-flash` / `gemini-2.5-flash-lite`

---

### 模块 5：工具调用追踪器 ⭐⭐⭐⭐⭐

**功能**：可视化工具执行流程、参数、结果

**API**：
```bash
/tools                         # 列出工具
/tools desc                    # 详细描述
```

**内置工具**：
| 工具名 | 显示名 | 需确认 |
|--------|--------|--------|
| `list_directory` | ReadFolder | 否 |
| `read_file` | ReadFile | 否 |
| `write_file` | WriteFile | 是 |
| `glob` | FindFiles | 否 |
| `grep_search` | SearchText | 否 |
| `replace` | Edit | 是 |
| `run_shell_command` | Shell | 是 |
| `google_web_search` | GoogleSearch | 否 |
| `web_fetch` | WebFetch | 否 |

**工具权限配置**：
```json
"tools.core": ["read_file", "run_shell_command(git)"],
"tools.exclude": ["run_shell_command(rm)"],
"tools.allowed": ["run_shell_command(git status)"]
```

---

### 模块 6：认证管理器 ⭐⭐⭐⭐⭐

**功能**：多账户切换、API Key 管理

**API**：
```bash
/auth                          # 认证对话框
```

**认证类型**：
```json
"security.auth.selectedType": "gemini-api-key"  // 或 "oauth", "vertex-ai"
```

**环境变量**：
```bash
GEMINI_API_KEY                 # Gemini API
GOOGLE_API_KEY                 # Vertex AI
GOOGLE_CLOUD_PROJECT           # Code Assist / Vertex
GOOGLE_GENAI_USE_VERTEXAI=true # 启用 Vertex
```

---

### 模块 7：GEMINI.md 上下文编辑器 ⭐⭐⭐⭐⭐

**功能**：分层上下文管理、实时预览

**API**：
```bash
/memory show                   # 显示完整上下文
/memory list                   # 列出文件路径
/memory add <text>             # 添加内容
/memory refresh                # 重新加载
/init                          # 自动生成
```

**配置**：
```json
"context.fileName": ["GEMINI.md", "CONTEXT.md"],
"context.includeDirectories": ["../lib"],
"context.loadMemoryFromIncludeDirectories": true
```

**层级**：Global (`~/.gemini/`) → Project Root → Subdirectory

---

### 模块 8：扩展市场 ⭐⭐⭐⭐

**功能**：发现、安装、管理扩展

**API**：
```bash
/extensions                    # 列出活动扩展
gemini extensions install <url|path>
gemini extensions uninstall <name>
gemini extensions list
```

**安全配置**：
```json
"security.blockGitExtensions": false,
"security.allowedExtensions": ["^https://github.com/google-gemini/.*"]
```

---

### 模块 9：自定义命令编辑器 ⭐⭐⭐⭐

**功能**：创建/编辑 TOML 命令

**命令位置**：
- 全局：`~/.gemini/commands/*.toml`
- 项目：`.gemini/commands/*.toml`

**TOML 结构**：
```toml
[command]
name = "cmd"
description = "Description"

[command.arguments]
arg1 = { type = "string", required = true, default = "value" }

[command.prompt]
template = "Prompt with {{arg1}}"
```

---

### 模块 10：技能管理器 ⭐⭐⭐⭐

**功能**：启用/禁用 Agent Skills

**API**：
```bash
/skills list                   # 列出技能
/skills enable <name>          # 启用
/skills disable <name>         # 禁用
/skills reload                 # 重新加载
```

**配置**：
```json
"skills.enabled": true,
"skills.disabled": ["skill-name"]
```

**位置**：Workspace (`.gemini/skills/`) → User (`~/.gemini/skills/`) → Extensions

---

### 模块 11：Shell 权限控制面板 ⭐⭐⭐⭐

**功能**：细粒度 Shell 命令控制

**配置**：
```json
"tools": {
  "core": [
    "run_shell_command(git)",
    "run_shell_command(npm)"
  ],
  "exclude": [
    "run_shell_command(rm)",
    "run_shell_command(git push)"
  ],
  "allowed": [
    "run_shell_command(git status)"
  ],
  "shell": {
    "enableInteractiveShell": true,
    "showColor": true,
    "inactivityTimeout": 300
  }
}
```

**命令匹配规则**：
- 前缀匹配：`git` 匹配 `git status`, `git log`
- 黑名单优先：`exclude` > `core`
- 链式命令拆分：`&&`, `||`, `;`

---

### 模块 12：Hooks 编辑器 ⭐⭐⭐⭐

**功能**：配置生命周期钩子

**API**：
```bash
/hooks list                    # 列出钩子
/hooks enable/disable <name>   # 启用/禁用
/hooks enable-all/disable-all  # 批量操作
```

**Hook 类型**：
| Hook | 触发时机 |
|------|----------|
| `BeforeTool` | 工具执行前 |
| `AfterTool` | 工具执行后 |
| `BeforeAgent` | Agent 循环开始 |
| `AfterAgent` | Agent 循环结束 |
| `SessionStart` | 会话开始 |
| `SessionEnd` | 会话结束 |
| `BeforeModel` | LLM 请求前 |
| `AfterModel` | LLM 响应后 |
| `PreCompress` | 压缩前 |
| `BeforeToolSelection` | 工具选择前 |
| `Notification` | 通知事件 |

---

### 模块 13：会话历史浏览器 ⭐⭐⭐⭐

**功能**：搜索/筛选/恢复历史会话

**API**：
```bash
/resume                        # 打开会话浏览器
```

**配置**：
```json
"general.sessionRetention": {
  "enabled": true,
  "maxAge": "30d",
  "maxCount": 100
}
```

---

### 模块 14：工作目录管理器 ⭐⭐⭐

**功能**：多目录工作区支持

**API**：
```bash
/directory show                # 显示目录
/directory add <path>          # 添加
/dir add ../lib,~/docs         # 多路径

gemini --include-directories ../lib,../docs  # 启动参数
```

**配置**：
```json
"context.includeDirectories": ["../lib", "~/docs"]
```

---

### 模块 15：Telemetry 仪表盘 ⭐⭐⭐

**功能**：性能监控、日志分析

**配置**：
```json
"telemetry": {
  "enabled": true,
  "target": "local",
  "otlpEndpoint": "http://localhost:4317",
  "otlpProtocol": "grpc",
  "logPrompts": true,
  "outfile": "~/.gemini/telemetry.log"
}
```

---

## 附录：GUI 与 CLI 集成方式

### 方式 1：进程调用（推荐）
```typescript
import { spawn } from 'child_process';

// 非交互式 JSON 输出
const gemini = spawn('gemini', [
  '-p', prompt,
  '--output-format', 'stream-json'
]);

gemini.stdout.on('data', (data) => {
  const events = data.toString().split('\n').filter(Boolean);
  events.forEach(e => handleEvent(JSON.parse(e)));
});
```

### 方式 2：直接读写配置
```typescript
import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const settingsPath = join(homedir(), '.gemini', 'settings.json');
const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
settings.model.name = 'gemini-3-flash-preview';
writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
```

### 方式 3：环境变量注入
```typescript
const env = {
  ...process.env,
  GEMINI_API_KEY: apiKey,
  GEMINI_MODEL: selectedModel
};

spawn('gemini', args, { env });
```
