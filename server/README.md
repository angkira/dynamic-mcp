# Dynamic MCP Server

Backend server for Dynamic MCP management built with Fastify and TypeScript.

## Available Scripts

In the project directory, you can run:

### `npm run dev`

**🔥 HOT RELOAD DEVELOPMENT MODE**
- Starts the server with **nodemon** for automatic restarts
- Watches TypeScript files for changes and rebuilds automatically
- Runs on development mode with detailed logging
- Open [http://localhost:3000](http://localhost:3000) to view it in the browser

### `npm run dev:watch`

Alternative development mode with concurrent TypeScript watching and server restart.

### `npm run build`

Compiles TypeScript to JavaScript in the `dist/` directory.

### `npm start`

Starts the production server from compiled JavaScript files.

### `npm run test`

Run the test cases.

## Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   # Create .env file with:
   LLM_PROVIDER=openai
   DEFAULT_MODEL=o4-mini
   OPENAI_API_KEY=your_key_here
   GEMINI_API_KEY=your_key_here
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

The server will automatically restart when you make changes to any TypeScript files in the `src/` directory.

## API Endpoints

- `GET /api/models` - Get all available LLM models
- `GET /api/config/default` - Get default provider/model configuration
- `GET /api/chats` - Get user chats with pagination
- `POST /api/message` - Send message (supports streaming)
- `POST /api/message/:chatId` - Send message to specific chat

## Features

- ✅ **Full CORS support** for external API access
- ✅ **Hot reload development** with nodemon
- ✅ **TypeScript compilation** with automatic rebuilds
- ✅ **Streaming support** via Server-Sent Events
- ✅ **Multiple LLM providers** (OpenAI, Gemini)
- ✅ **Database integration** with Prisma

## Learn More

To learn Fastify, check out the [Fastify documentation](https://fastify.dev/docs/latest/).
