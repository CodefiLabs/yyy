# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dyad is a local, open-source AI app builder - an Electron desktop application that enables users to build React applications using AI assistance while maintaining complete privacy and control. Everything runs locally with bring-your-own API keys.

## Essential Commands

### Development
```bash
npm install           # Install dependencies
npm start            # Start development server (Electron app)
npm run dev:engine   # Start with local engine
```

### Database
```bash
npm run db:generate  # Generate DB migrations from schema changes
npm run db:push      # Apply migrations to database
npm run db:studio    # Open database studio for inspection
```

### Testing
```bash
npm test            # Run unit tests with Vitest
npm run test:watch  # Run tests in watch mode
npm run e2e         # Run E2E tests with Playwright
```

### Code Quality
```bash
npm run lint        # Run oxlint linter
npm run lint:fix    # Auto-fix linting issues
npm run prettier    # Format code with Prettier
npm run presubmit   # Run all checks before committing
```

## Architecture

### Electron Architecture
- **Main Process** (`src/main.ts`): Privileged Node.js process handling OS-level operations
- **Renderer Process** (`src/renderer.tsx`): Sandboxed React UI
- **Preload Script** (`src/preload.ts`): Security bridge exposing safe IPC methods
- **IPC Communication**: All main/renderer communication goes through IPC handlers

### Key Technologies
- **UI Framework**: React 19 with TypeScript
- **Routing**: TanStack Router (NOT React Router or Next.js)
- **State Management**: Jotai atoms + TanStack Query for server state
- **Styling**: TailwindCSS v4 + shadcn/ui components
- **Database**: SQLite with Drizzle ORM
- **Build Tool**: Vite
- **Code Editor**: Monaco Editor
- **Testing**: Vitest (unit) + Playwright (E2E)

### Directory Structure
- `src/ipc/`: Inter-process communication
  - `handlers/`: Main process IPC handlers
  - `processors/`: Response processors for AI outputs
- `src/atoms/`: Jotai state atoms
- `src/hooks/`: Custom React hooks (38+ hooks)
- `src/components/`: React components (58+ components)
- `src/routes/`: TanStack Router route definitions
- `src/pages/`: Route-specific page components
- `src/db/`: Database schema and utilities
- `src/prompts/`: AI system prompts

### IPC Pattern
```typescript
// Renderer: Use IpcClient singleton
const result = await IpcClient.app.getVersion();

// Main: Handlers throw errors (don't return success/failure objects)
ipcMain.handle('app:getVersion', async () => {
  if (error) throw new Error('Failed');
  return version;
});
```

### React Query Pattern
```typescript
// Data fetching with caching
const { data } = useQuery({
  queryKey: ['key'],
  queryFn: () => IpcClient.method()
});

// Mutations with invalidation
const mutation = useMutation({
  mutationFn: () => IpcClient.method(),
  onSuccess: () => queryClient.invalidateQueries(['key'])
});
```

## AI Response Processing

LLM responses use custom XML-like tags that are processed:
- `<dyad-write>`: Write/create files
- `<dyad-delete>`: Delete files
- `<dyad-exec>`: Execute commands
- `<dyad-think>`: AI reasoning (hidden from user)

Responses are parsed by custom Markdown processor and applied via response processors.

## Important Notes

- **No React Router/Next.js**: Uses TanStack Router exclusively
- **Error Handling**: IPC handlers throw errors, don't return { success: false }
- **State Management**: Jotai for client state, TanStack Query for server state
- **Testing**: Run lint and tests before committing (`npm run presubmit`)
- **AI Providers**: Supports OpenAI, Anthropic, Google, Amazon Bedrock, xAI, Ollama, LM Studio
- **Security**: Electron context isolation enabled, use preload script for IPC exposure