# Signals Notebook Extension

Chrome extension providing enhanced features for [Signals Notebook](https://www.signalsnotebook.com/).

See [docs/architecture.md](docs/architecture.md) for design details.

## Project structure

```
src/
  content/       # Content script injected into the configured SNB domain (isolated world)
  injected/      # Main-world bridge script (e.g. for reading page-context state)
  background/    # Service worker: config, permissions, dynamic content script registration
  popup/         # Extension popup UI (React + antd)
  options/       # Options page — user configures their SNB hosts (React + antd)
  shared/        # Cross-context types and storage helpers
public/          # Static assets (icons)
docs/            # Architecture and design notes
```

## Development

```bash
pnpm install
pnpm dev     # builds to dist/ in watch mode
```

Load the extension in Chrome:

1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `dist/` directory

After the first run, open the extension's options page and add your
Signals Notebook host(s) to grant it host access.

## Build

```bash
pnpm build
```
