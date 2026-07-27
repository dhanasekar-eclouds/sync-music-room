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

## Deploy to GitHub Pages

```bash
cd client
npm run deploy
```

## How to use

1. Open the app → click **Create New Room**
2. Set a nickname + room password
3. Share the link + room code + password with friends
4. Host clicks **Upload Song** and picks an audio file
5. Everyone hears the same song in sync
6. Chat, react with emojis, adjust volume

## Features

- P2P audio sync via WebRTC
- File upload (MP3, WAV, FLAC, OGG)
- Per-user volume control
- Real-time chat
- Emoji reactions
- Playlist queue
- User list with kick
- End session
- Host transfer + leave guard
- Dark mode
- Room password protection
- No backend, no install, no cost

## Tech Stack

- React 18 + Vite
- PeerJS (WebRTC signaling)
- Web Audio API
- GitHub Pages
