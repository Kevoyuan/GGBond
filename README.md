# Gemini CLI Assistant

A powerful web-based assistant that leverages Google's Gemini AI to help users interact with their system through a conversational interface. This application provides a chat-based UI where users can ask questions about their system, run commands, and manage various tasks using AI-powered assistance.

## Features

- **AI-Powered Assistance**: Utilizes Google's Gemini AI model for intelligent responses
- **File System Explorer**: Browse and interact with your local file system
- **Command Execution**: Run system commands safely through the AI interface
- **Code Analysis**: Get insights and explanations about your codebase
- **Chat Interface**: Clean, responsive UI for seamless conversations
- **Token Usage Tracking**: Monitor API usage and costs
- **Workspace Management**: Organize and switch between different workspaces
- **Settings Panel**: Configure API keys and preferences

## Tech Stack

- **Frontend**: Next.js 14 with App Router
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **AI Integration**: Google Gemini API
- **Database**: SQLite (via Drizzle ORM)
- **Type Safety**: TypeScript
- **Testing**: Vitest

## Prerequisites

- Node.js (version 18 or higher)
- Google Gemini API key
- npm, yarn, pnpm, or bun package manager

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd gemini-cli-assistant
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Add your Google Gemini API key to `.env.local`:
```
NEXT_PUBLIC_GEMINI_API_KEY=your_api_key_here
```

## Usage

1. Start the development server:
```bash
npm run dev
```

2. Open your browser and navigate to [http://localhost:3000](http://localhost:3000)

3. Configure your settings using the settings dialog (accessible via the header)

4. Begin chatting with the AI assistant to perform tasks, analyze code, or explore your file system

## API Documentation

For detailed information about the API endpoints, see:
- [gemini-cli-api.md](./gemini-cli-api.md) - Backend API documentation
- [gemini-cli-ui-api.md](./gemini-cli-ui-api.md) - UI component API documentation

## Configuration

The application can be configured through environment variables and the in-app settings panel:

- `NEXT_PUBLIC_GEMINI_API_KEY`: Your Google Gemini API key
- Model selection: Choose between different Gemini models (pro, flash)
- Temperature settings: Adjust AI response randomness
- Workspace settings: Define default workspace paths

## Contributing

We welcome contributions to enhance the functionality and usability of the Gemini CLI Assistant. To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions, please file an issue in the repository or consult the documentation files included in the project.
