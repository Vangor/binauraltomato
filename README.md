# FocusForge

A full-stack web application for ADHD-focused Pomodoro sessions with binaural white noise. Built with React + TypeScript + Vite, designed for easy Electron port to macOS app.

## Features

### 🍅 Pomodoro Timer
- Configurable work/break lengths (default: 25min work, 5min short break, 15min long break every 4 cycles)
- Start/pause/stop controls with auto-advance to break after work ends
- Visual progress circle with smooth animations
- Fullscreen mode for immersive focus sessions
- Manual session end and break switching

### 📅 Calendar View
- Weekly/monthly grid showing past work sessions
- Visual bars for total focus time per day
- Click any day to see detailed breakdown (cycles completed, total minutes)
- Track streaks and total hours worked
- All data persisted in localStorage as JSON

### 🎵 Binaural White Noise
- Toggle button to enable/disable audio
- Web Audio API for local generation (no external libraries)
- Presets:
  - White noise
  - Pink noise
  - Binaural beats (Beta 20Hz for focus)
  - Binaural beats (Gamma 40Hz for deep focus)
- Volume slider and fade in/out controls
- Real-time stereo audio generation with left/right frequency offset

### 🎨 UI/UX
- Minimalist dark mode (ADHD-friendly: low contrast, no distractions)
- Responsive, mobile-first design
- Keyboard shortcuts (Space = pause/play, Cmd+S = stop, Cmd+F = fullscreen)
- Full accessibility support (ARIA labels, keyboard navigation)
- Browser notifications for session completion

## Quick Start

### Prerequisites
- [Bun](https://bun.sh) (latest version)
- Modern browser with Web Audio API support

### Installation

```bash
# Install dependencies
bun install

# Start development server
bun run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
# Build web app
bun run build

# Preview production build
bun run preview
```

## Electron macOS App

### Development

```bash
# Run Electron app in development mode
bun run electron
```

### Build macOS App

```bash
# Build Electron app
bun run electron:build
```

This will create a `.dmg` file in the `dist` folder that you can distribute.

### Using Electron Forge (Alternative)

```bash
# Install Electron Forge
bun add -d @electron-forge/cli
bunx electron-forge import

# Build with Forge
bun run electron:forge
```

## Project Structure

```
src/
├── components/          # React components
│   ├── Timer.tsx       # Pomodoro timer with progress circle
│   ├── Calendar.tsx    # Weekly/monthly calendar view
│   └── NoiseGenerator.tsx  # Audio controls and presets
├── hooks/              # Custom React hooks
│   ├── useTimer.ts     # Timer logic and state management
│   ├── useAudio.ts     # Web Audio API integration
│   └── useLocalStorage.ts  # localStorage persistence
├── utils/              # Utility functions
│   ├── sessionStorage.ts  # Session data management
│   ├── formatTime.ts   # Time formatting helpers
│   └── notifications.ts # Browser notification API
├── types/              # TypeScript type definitions
│   └── index.ts        # Shared types and interfaces
├── App.tsx             # Main application component
└── main.tsx            # Application entry point
```

## Keyboard Shortcuts

- **Space**: Pause/Resume timer
- **Cmd/Ctrl + S**: Stop timer
- **Cmd/Ctrl + F**: Toggle fullscreen

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Electron 28+

## PWA Support

The app is configured as a Progressive Web App (PWA) and can be installed on:
- iOS (via Safari "Add to Home Screen")
- Android (via Chrome "Add to Home Screen")
- Desktop browsers (Chrome, Edge)

## Data Persistence

All data is stored locally in the browser's `localStorage`:
- Pomodoro configuration (work/break durations)
- Audio preferences (preset, volume, fade settings)
- Session history (dates, cycles, total minutes)

No backend or external services required!

## Development

### Code Standards
- TypeScript strict mode enabled
- ESLint for code quality
- Tailwind CSS for styling
- Component-based architecture
- Bun for package management and fast builds

### Adding New Features

1. Create components in `src/components/`
2. Add custom hooks in `src/hooks/`
3. Update types in `src/types/index.ts`
4. Add utilities in `src/utils/`

### Why Bun?

- **Faster installs**: Bun installs dependencies significantly faster than npm/yarn
- **Built-in TypeScript**: No need for separate TypeScript compilation in many cases
- **Native performance**: Written in Zig, optimized for speed
- **npm-compatible**: Works seamlessly with existing npm packages and scripts

## Troubleshooting

### Audio not working
- Ensure browser allows autoplay (check browser settings)
- Check browser console for Web Audio API errors
- Try enabling audio manually via the toggle button

### Notifications not showing
- Grant notification permissions when prompted
- Check browser notification settings
- Some browsers require user interaction before showing notifications

### localStorage issues
- Clear browser cache if data seems corrupted
- Check browser DevTools > Application > Local Storage
- Data is browser-specific (won't sync across browsers)

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.
