# Gemini CodePilot

A pixel-perfect AI IDE interface for gemini-cli, providing a modern GUI for Google's Gemini CLI tool with enhanced visualization and management capabilities.

## Overview

Gemini CodePilot is a Next.js-based desktop application that provides a graphical user interface for the Gemini CLI tool. It offers enhanced features like token usage visualization, MCP server management, session history, and a streamlined chat interface for AI-assisted development.

## Features

- **Modern Chat Interface**: Clean, responsive UI for interacting with Gemini models
- **Token Usage Tracking**: Real-time visualization of input/output/cached tokens
- **MCP Server Management**: Integrated management of Model Context Protocol servers
- **Session History**: Persistent chat sessions with workspace support
- **File Explorer**: Integrated file browsing and preview capabilities
- **Settings Management**: GUI for configuring Gemini CLI settings
- **Skills Integration**: Management of AI skills and capabilities
- **Context Visualization**: Clear display of active context and memory usage
- **Multi-Model Support**: Easy switching between different Gemini models
- **Workspace Management**: Organize projects with dedicated workspaces

## Tech Stack

- **Framework**: Next.js 16.1.6
- **Runtime**: React 19.2.3, React DOM 19.2.3
- **Styling**: Tailwind CSS, Tailwind CSS Animate
- **UI Components**: shadcn/ui, Lucide React icons
- **Database**: Better SQLite3
- **Animation**: Framer Motion
- **Date Utilities**: date-fns
- **Syntax Highlighting**: react-syntax-highlighter
- **Markdown Rendering**: react-markdown
- **UUID Generation**: uuid
- **Type Safety**: TypeScript
- **Linting**: ESLint
- **Testing**: Vitest

## Prerequisites

- Node.js 18+ (recommended)
- npm or yarn package manager
- Google Gemini API key or OAuth credentials
- Gemini CLI installed and configured

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/gem-ui.git
cd gem-ui
```

2. Install dependencies:
```bash
npm install
```

3. Set up your Gemini API credentials:
```bash
# Add your API key to environment variables
export GEMINI_API_KEY="your-api-key-here"
```

4. Run the development server:
```bash
npm run dev
```

5. Open your browser to [http://localhost:3000](http://localhost:3000)

## Configuration

The application integrates with the standard Gemini CLI configuration located at `~/.gemini/settings.json`. You can customize various aspects of the CLI behavior through this file, including:

- Model selection and parameters
- MCP server configurations
- Tool permissions and approval modes
- Context management settings
- UI preferences

## Usage

### Starting a New Chat
1. Open the application
2. Select your preferred model from the dropdown
3. Type your prompt in the input field at the bottom
4. Press Enter or click the send button

### Managing Sessions
- View all previous sessions in the sidebar
- Click on any session to resume the conversation
- Delete sessions you no longer need
- Create new chats with the "+" button

### Workspace Management
- Add workspaces to focus on specific projects
- Each workspace maintains its own context
- Switch between workspaces seamlessly

### Token Monitoring
- Monitor real-time token usage in the header
- View detailed usage statistics in the usage dialog
- Track cost estimates and context window usage

### MCP Server Management
- View connected MCP servers in the settings panel
- Manage server status and configurations
- Add or remove MCP servers as needed

## Development

### Running in Development Mode
```bash
npm run dev
```

### Building for Production
```bash
npm run build
```

### Running Tests
```bash
npm run test
```

### Linting
```bash
npm run lint
```

## Project Structure

```
gem-ui/
├── app/                    # Next.js app router pages
│   ├── api/               # API routes
│   ├── modules/           # Feature modules
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main page
├── components/            # Reusable UI components
├── lib/                   # Utility functions and services
│   ├── api/              # API helpers
│   ├── types/            # TypeScript type definitions
│   ├── db.ts             # Database utilities
│   ├── gemini-service.ts # Gemini CLI integration
│   ├── gemini-utils.ts   # Gemini utilities
│   ├── pricing.ts        # Pricing calculations
│   └── utils.ts          # General utilities
├── public/                # Static assets
├── __tests__/            # Test files
└── ...
```

## API Integration

The application communicates with the Gemini CLI through a service layer that executes CLI commands and parses responses. Key integration points include:

- Chat completions via CLI process spawning
- Settings management through configuration files
- Token usage tracking from CLI output
- MCP server management
- Session persistence

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## Troubleshooting

### Common Issues

1. **Gemini CLI not found**: Ensure the `gemini` command is available in your PATH
2. **API Key Issues**: Verify your GEMINI_API_KEY environment variable is set correctly
3. **Permission Errors**: Check that the application has necessary file system permissions

### Debugging

Enable additional logging by setting the `NODE_ENV` environment variable to `development`.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with Next.js and the Gemini CLI
- Inspired by modern AI development workflows
- UI components from shadcn/ui