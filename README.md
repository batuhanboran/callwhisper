# CallWhisper

Real-time AI sales coaching during Zoom calls. Captures rep mic + Zoom system audio simultaneously, transcribes both streams live via Deepgram, and feeds rolling context into Gemini every 8 seconds to generate actionable coaching suggestions.

## Architecture

```
macOS (Chrome browser)
  ├── mic stream ──────────────────────────┐
  └── BlackHole stream (Zoom audio) ───────┤
                                           ↓ WebSocket binary (PCM 16kHz mono)
                         callwhisper-backend (Docker, LXC 100 / :3003)
                           ├── /audio-rep    → Deepgram Nova-2 (Rep stream)
                           ├── /audio-prospect → Deepgram Nova-2 (Prospect stream)
                           ├── transcript.js → rolling 90s buffer, speaker labels
                           └── coach.js      → Gemini 2.0 Flash every 8s*
                                           ↓ WebSocket /events (JSON)
                         macOS (Chrome browser)
                           ├── Left panel:  live transcript [Rep] / [Prospect]
                           ├── Right panel: coaching history (last 5, newest on top)
                           └── Header:      stream status · audio levels · talk ratio
```

*Critical moments (watch_out fired) trigger immediate re-coaching at 3s instead of 8s.

**Why this stack:**
- BlackHole: free virtual audio driver, routes Zoom output to Chrome input
- Deepgram Nova-2: streaming API, partial transcripts under 2s
- Gemini 2.0 Flash: structured JSON output, free tier (15 RPM), model selector in UI
- Browser + Node: no Electron compile step, fast iteration

## Prerequisites

- macOS with [BlackHole-2ch](https://existential.audio/blackhole/) installed
- Zoom configured: Settings → Audio → Speaker → BlackHole 2ch
- Node.js 20+ (dev only — production runs in Docker)

```bash
brew install blackhole-2ch
```

## Setup (Dev)

```bash
# Backend
npm install
cp .env.example .env
# fill in DEEPGRAM_API_KEY and GEMINI_API_KEY

# Frontend
cd client
npm install
```

## Environment

```bash
DEEPGRAM_API_KEY=your_key
GEMINI_API_KEY=your_key
PORT=3001
COACHING_INTERVAL_MS=8000   # Gemini called every 8s
TRANSCRIPT_WINDOW_S=90      # rolling context window
```

## Run (Dev)

```bash
# Terminal 1 — backend
npm run dev

# Terminal 2 — frontend (with WS proxy to backend)
cd client && npm run dev
```

Open `http://localhost:5173`, click **Start**, select mic + BlackHole devices.

## Run (Docker / Production)

```bash
docker compose up -d --build
```

Backend + built frontend served on `:3001` (mapped to host `:3003`).

## Audio Capture Verification

Before the first real test, open `scripts/test-audio.html` in Chrome:
1. Click "Start Both"
2. Should show two active MediaStream objects — one mic, one BlackHole
3. Speak → mic stream active; play Zoom audio → BlackHole stream active

This is Phase 0 gate. Do not proceed without passing it.

## Known Limitations

- **BlackHole dependency**: System audio capture requires manual BlackHole setup and Zoom audio routing. First-time setup ~5 minutes.

- **No session persistence**: Transcripts and coaching live in memory only. Restart clears all state.

- **Coaching latency**: Gemini API adds 1–3s on top of transcription. Total end-to-end ~4–5s from speech to suggestion.

- **No diarization within stream**: Speaker ID is by audio source (stream 1 = Rep, stream 2 = Prospect). Cross-talk within one stream is not separated.

- **No reconnection persistence**: If a Deepgram WebSocket drops, it reconnects automatically (unlimited retries, exponential backoff) but transcript history from before the drop is not replayed.

- **macOS only**: Not tested on Windows or Linux.

## Repository Structure

```
callwhisper/
├── server/
│   ├── index.js        Express + WS server, serves static frontend
│   ├── deepgram.js     Dual Deepgram Nova-2 streaming connections
│   ├── transcript.js   Rolling 90s buffer, Rep/Prospect labels
│   └── coach.js        Gemini 2.0 Flash, 8s throttle, model selector, structured output
├── client/
│   └── src/
│       ├── App.jsx     UI: transcript panel + coaching panel
│       └── capture.js  getUserMedia, float32→int16 PCM, dual WS senders
├── scripts/
│   └── test-audio.html Phase 0 device test
├── Dockerfile          Multi-stage: Vite build + node:20-slim runtime
├── docker-compose.yml  LXC 100 deployment (port 3003)
└── .env.example
```

## Built With

[Claude Code](https://claude.ai/code) (claude-sonnet-4-6) — see `SESSION_LOG.md` for AI-assisted build log.
