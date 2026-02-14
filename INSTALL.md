# FocusForge Installation Guide

## Prerequisites

Install [Bun](https://bun.sh) if you haven't already:

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Or via Homebrew
brew install bun
```

## Quick Start

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Start development server:**
   ```bash
   bun run dev
   ```

3. **Open in browser:**
   Navigate to `http://localhost:5173`

## Building for Production

### Web App

```bash
# Build the web app
bun run build

# Preview the production build
bun run preview
```

The built files will be in the `dist/` directory.

### Electron macOS App

#### Option 1: Using Electron Builder (Recommended)

```bash
# Build the web app first
bun run build

# Build Electron app
bun run electron:build
```

This creates a `.dmg` file in the `dist/` folder.

#### Option 2: Using Electron Forge

```bash
# Install Electron Forge CLI
bun add -d @electron-forge/cli

# Import Forge configuration
bunx electron-forge import

# Build with Forge
bun run electron:forge
```

## Development Mode with Electron

```bash
# Terminal 1: Start Vite dev server
bun run dev

# Terminal 2: Run Electron (in another terminal)
bun run electron
```

Note: The Electron main process will connect to `http://localhost:5173` in development mode.

## Troubleshooting

### Audio Issues

- **No audio playing**: Check browser console for Web Audio API errors
- **Permission denied**: Some browsers require user interaction before playing audio
- **Audio context suspended**: Click the audio toggle button to resume

### Build Issues

- **TypeScript errors**: Run `bun run lint` to check for issues
- **Electron build fails**: Ensure you've run `bun run build` first
- **Missing dependencies**: Delete `node_modules` and `bun.lockb`, then run `bun install` again

### PWA Installation

- **iOS**: Open in Safari, tap Share → Add to Home Screen
- **Android**: Open in Chrome, tap Menu → Install App
- **Desktop**: Click the install icon in the address bar (Chrome/Edge)

## Environment Variables

No environment variables are required for basic functionality. All data is stored locally in `localStorage`.

## Next Steps

1. Customize Pomodoro durations in Settings
2. Enable binaural audio for focus sessions
3. Track your progress in the Calendar view
4. Build Electron app for native macOS experience
