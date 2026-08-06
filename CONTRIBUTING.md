# Contributing

Development setup and guidelines for Signals Notebook Extension.

## Project Structure

```
src/
  content/       # Content script injected into SNB pages (isolated world)
  injected/       # Main-world bridge script (for reading page-context state)
  background/    # Service worker: config, permissions, dynamic content script registration
  popup/         # Extension popup UI (React + antd)
  options/       # Options page for configuring SNB hosts (React + antd)
  shared/        # Cross-context types and storage helpers
public/          # Static assets (icons)
docs/            # Architecture and design notes
```

## Development

```bash
pnpm install
pnpm dev        # Vite dev server, builds to dist/ in watch mode
pnpm build      # TypeScript check + production build
pnpm test       # Run tests with vitest
pnpm test:watch # Test watch mode
```

## Loading the Extension

1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `dist/` directory
4. Open the extension's options page and add your SNB host(s)

## Architecture

Each directory under `src/` is a distinct runtime context:

- **background/** - Service worker for orchestration only (permissions, content script registration)
- **content/** - Isolated world, dynamically registered against configured SNB hosts
- **injected/** - Main world bridge for accessing page globals (e.g., Redux store)
- **popup/**, **options/** - Standalone HTML documents with React + antd

Cross-context imports go through `@shared/*` (aliased to `src/shared`).

See [docs/architecture.md](docs/architecture.md) for detailed design notes.

## Code Style

- No linting/formatting setup yet - follow existing patterns
- Add tests alongside modules in `*.test.ts` files

## Testing

Tests use [vitest](https://vitest.dev/). Run with:

```bash
pnpm test
```

CI runs tests before build.
