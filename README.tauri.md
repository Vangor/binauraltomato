# Tauri (Rust) desktop build

This branch adds **Tauri 2** alongside Electron. The app stays **React + Vite**; the desktop shell is Rust instead of Node/Electron.

## Prerequisites

- **Rust**: Install from https://rustup.rs (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`), then restart the terminal.

## Commands

| Script | Description |
|--------|-------------|
| `npm run tauri:dev` | Start Vite dev server and open Tauri window (hot reload). |
| `npm run tauri:build` | Build production bundle (Vite build + Tauri bundle). |
| `npm run tauri` | Run Tauri CLI (e.g. `npm run tauri -- build`). |

Electron scripts (`electron:dev`, `electron:build`) are unchanged for comparison.

## Layout

- **Frontend**: Unchanged. Still `src/` (React, Vite). Works in browser, Electron, or Tauri.
- **Rust**: `src-tauri/` — Tauri app (window, build, future native APIs).
- **Vite**: `vite.config.ts` includes Tauri-friendly options (port 5173, `TAURI_*` env, etc.).

## Next steps (optional)

- Implement lock/suspend handling in Rust (`tauri-plugin-os`) and expose to the frontend.
- Add Tauri commands for native features and call them from React via `@tauri-apps/api`.
- Remove or keep Electron; Tauri can be the only desktop target.
