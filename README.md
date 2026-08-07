# 🎵 Sync Music Room

**100% web-based.** No server, no install, no terminal. Just open a URL.

## How it works

This app uses **PeerJS** (WebRTC) to connect browsers directly — peer-to-peer. The host uploads a song, and everyone in the room hears it in sync. No audio ever touches a server.

## Architecture

```
Host Browser ──WebRTC──► Guest Browser A (hears audio + chat)
            ├──WebRTC──► Guest Browser B (hears audio + chat)
            └──WebRTC──► Guest Browser C (hears audio + chat)
```

- **Signaling**: PeerJS Cloud (free, powered by Cloudflare)
- **Audio**: WebRTC MediaStream (P2P, no server bandwidth)
- **Chat/Sync**: WebRTC DataChannel (P2P)
- **Hosting**: GitHub Pages (free static hosting)

## Quick Start (development)

```bash
cd client
npm install
npm run dev
# Opens at http://localhost:5173/sync-music-room
```

Run tests with `npm test` (in `client/`). CI (`.github/workflows/ci.yml`) runs the client build+tests on every push/PR, plus a Windows job that compiles the local relay (`local-relay/LocalRelay.csproj`).

## Deploy to GitHub Pages

```bash
cd client
npm run deploy
```

## How to use

1. Open the app → click **Create New Room**
2. Set a nickname + room password
3. Share the link + room code + password with friends
4. Host starts **PC Audio** capture via the local relay — captures your PC's audio output (Spotify, YouTube, etc.). This captures everything playing on the machine, not just the selected app — picking a source just labels the stream and auto-stops capture when that app closes.
5. Everyone hears the same song in sync
6. Chat, react with emojis, adjust volume

## PC Audio Capture (Local Relay)

To stream audio from any desktop app (Spotify, Chrome, etc.):

```powershell
# One-time setup: installs .NET SDK + builds the relay
cd local-relay
.\setup-relay.ps1
```

Or just [download the pre-built exe directly](https://github.com/dhanasekar-eclouds/sync-music-room/raw/master/local-relay/dist/SyncAudioRelay.exe) — no build step needed. A download link is also shown in the web app itself (on the homepage when creating a room, and in the PC Audio tab if the relay isn't running).

Then run `local-relay\dist\SyncAudioRelay.exe` — it appears in the system tray. Open the web app, create a room, click the **PC Audio** tab, and pick your audio source.

> **Note:** The pre-built relay exe is tracked via Git LFS. After cloning, run `git lfs pull` to download `local-relay\dist\SyncAudioRelay.exe` (154 MB, self-contained, no .NET needed to run). If you don't want the LFS download, just run `.\setup-relay.ps1` to build it from source.

## Features

- P2P audio sync via WebRTC
- Per-user volume control
- Real-time chat
- Emoji reactions
- Playlist queue
- User list with kick
- End session
- Host transfer + leave guard
- Dark mode
- Room password protection
- **PC Audio Capture** (Spotify, YouTube, browser, any app) via local tray relay
- Installable (PWA) — add to home screen / desktop for an app-like window
- No backend, no server cost

## Tech Stack

- React 18 + Vite
- PeerJS (WebRTC signaling)
- Web Audio API
- GitHub Pages
