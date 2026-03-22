# API Routes — Sidecar Proxy Layer

This directory contains the API route handlers for GGBond.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     GGBond Architecture                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Browser / React UI                                         │
│    │                                                        │
│    │ fetch('/api/chat', POST)                              │
│    ▼                                                        │
│  Next.js Static Export (compiled from legacy-api/)         │
│    │  NextResponse from @/src-sidecar/mock-next-server     │
│    ▼                                                        │
│  Node.js Sidecar Process (@google/gemini-cli-core)         │
│    │  All business logic lives here                         │
│    ▼                                                        │
│  SQLite (.gemini/ggbond.db)                                │
│  File System (workspace)                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key insight**: `legacy-api/` is the source. It is compiled into `app/api/` in the static export for Tauri bundling. All routes delegate to the sidecar — there is no business logic in these handlers.

## Route Structure

```
legacy-api/
├── agents/          # Agent CRUD and execution
├── analytics/       # Tool usage statistics
├── ask/             # Simple ask mode (no agent)
├── auth/            # Authentication helpers
├── browser/         # Browser MCP integration
├── chat/            # Chat streaming and control
│   ├── control/     # Stop/cancel ongoing operations
│   ├── headless/   # Headless chat mode
│   ├── snapshots/   # Session snapshot management
│   └── status/      # Background job status polling
├── commands/        # Custom commands
├── config/          # App configuration
│   ├── custom-commands/
│   ├── geminiignore/
│   └── trusted-folders/
├── confirm/         # Tool confirmation handling
├── core/            # Core service endpoints
├── custom-tools/    # User-defined tools
├── debug/           # Debug endpoints
├── directories/     # Directory listing
├── extensions/      # Extension gallery
├── files/           # File operations
│   └── content/     # File content reading
├── git/             # Git operations (branch listing)
├── governance/      # Governance/advisory mode
├── hooks/           # Hook management
├── mcp/             # MCP server registry
│   └── gallery/     # MCP gallery
├── memory/          # Memory/knowledge management
├── models/          # Available models
├── open/            # Open file/URL
├── presets/         # Session presets
├── queue/           # Background job queue
│   ├── process/
│   └── status/
├── quota/           # Token quota tracking
├── resolve-model/   # Model resolution
├── sessions/        # Session management
│   ├── [id]/
│   │   ├── archive/
│   │   ├── branch/
│   │   └── (session CRUD)
│   ├── core/
│   └── latest-stats/
├── settings/        # User settings
├── skills/          # Skill management
├── stats/           # Token usage stats
├── telemetry/       # Telemetry
├── terminal/        # Terminal operations
│   ├── input/
│   ├── stream/
│   └── stop/
├── tool-output/     # Tool output streaming
│   └── stream/
└── tools/           # Tool registry
```

## How Routes Work

Each route handler:
1. Receives the request from the React UI
2. Forwards it to the sidecar process via HTTP or direct function call
3. Returns the sidecar's response to the UI

Example flow for `/api/chat`:
```typescript
// legacy-api/chat/route.ts
import { NextResponse } from '@/src-sidecar/mock-next-server';
// The handler validates input, then calls CoreService or proxies to sidecar
```

## Adding a New Route

1. Create `legacy-api/<domain>/route.ts` (or `route.ts` at any level)
2. Import `NextResponse` from `@/src-sidecar/mock-next-server` — NOT from `next/server`
3. Keep all business logic in the sidecar (Node.js) or `lib/`
4. Do not add business logic directly in the route handler
5. Add the route to this README's route structure above
