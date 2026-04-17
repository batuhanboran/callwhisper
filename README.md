# CallWhisper

Real-time AI sales coaching during live calls. Captures rep mic + caller audio simultaneously, transcribes both streams live via Deepgram Nova-2, and feeds rolling context into Gemini (or Claude) every 8 seconds to generate actionable coaching suggestions.

## Live Demo

**[callwhisper.batuhanboran.com](https://callwhisper.batuhanboran.com)**

## Architecture

```
Browser (Chrome)
  ├── Rep mic ──────────────────────────────┐
  └── Tab/screen audio (getDisplayMedia) ───┤
                                            ↓ WebSocket binary (PCM 16kHz mono)
                          callwhisper-backend (Docker, LXC 100)
                            ├── /audio-rep      → Deepgram Nova-2 (Rep)
                            ├── /audio-prospect → Deepgram Nova-2 (Prospect)
                            ├── transcript.js   → rolling 90s buffer, speaker labels
                            └── coach.js        → Gemini / Claude every 8s
                                            ↓ WebSocket /events (JSON)
                          Browser (Chrome)
                            ├── Left panel:  live transcript [Rep] / [Prospect]
                            ├── Right panel: coaching history (last 5, newest on top)
                            └── Header:      stream status · audio levels · talk ratio
```

Critical moments (`watch_out` fired) trigger immediate re-coaching at 3s.

**Why this stack:**
- `getDisplayMedia`: browser-native tab audio capture — no virtual audio driver needed
- Deepgram Nova-2: streaming WebSocket API, partial transcripts under 2s
- Gemini free tier: 1500 RPD, auto-fallback chain on rate limits
- Claude support: optional, enter Anthropic key in UI
- Browser + Node: no Electron compile step, runs in Docker on any Linux host

## Setup

### Prerequisites

- Node.js 20+
- Chrome (required for tab audio capture)
- Deepgram API key — [console.deepgram.com](https://console.deepgram.com)
- Gemini API key — [aistudio.google.com](https://aistudio.google.com) (free tier sufficient)

### Install

```bash
npm install
cd client && npm install
```

### Environment

```bash
cp .env.example .env
# Fill in:
DEEPGRAM_API_KEY=your_deepgram_key
GEMINI_API_KEY=your_gemini_key   # fallback if not entered in UI
PORT=3001
COACHING_INTERVAL_MS=8000
TRANSCRIPT_WINDOW_S=90
```

### Run (Dev)

```bash
# Terminal 1 — backend
npm run dev

# Terminal 2 — frontend
cd client && npm run dev
```

Open `http://localhost:5173`.

### Run (Docker)

```bash
docker compose up -d --build
```

Backend + built frontend on `:3001` (mapped to `:3003` in docker-compose).

## Usage

1. Open CallWhisper in **Chrome**
2. Optionally enter API keys directly in the header (saved to localStorage, override `.env`)
3. Select **Rep mic** — your microphone
4. Select **Prospect** → **🖥 Share Tab / Screen Audio** (default)
5. Click **▶ Start Session**
6. Chrome shows share dialog → pick Zoom or call tab → check **"Share tab audio"** → Share
7. Speak as rep → `[Rep]` lines appear; caller audio → `[Prospect]` lines appear
8. AI coaching appears in right panel within ~8s
9. **■ Stop Session** clears transcript + coaching for next session

### macOS with BlackHole (alternative)

On macOS with [BlackHole-2ch](https://existential.audio/blackhole/) installed:
- Zoom → Settings → Audio → Speaker: **BlackHole 2ch**
- In Prospect dropdown select **BlackHole 2ch** instead of "Share Tab Audio"

## AI Coaching

Coaching fields returned every 8s (or 3s on critical signal):

| Field | Description |
|-------|-------------|
| `say_this` | Exact phrase to say right now |
| `ask_this` | Follow-up question to ask |
| `watch_out` | Signal detected (budget concern, competitor, stall, buying signal) |
| `objection_type` | price / timing / authority / competitor / feature |
| `call_stage` | opening / discovery / demo / objection / closing |

**Rate limit handling:** On 429, auto-falls back:
`gemini-2.5-flash` → `gemini-2.5-flash-lite` → `gemini-2.0-flash` → `gemini-2.0-flash-lite`

**Model switching:** Change model mid-session from the dropdown — takes effect immediately.

**Claude:** Select any Claude model from dropdown, enter Anthropic API key in the key field.

## Known Limitations

- **Chrome required**: `getDisplayMedia` tab audio capture works reliably in Chrome only.
- **Echo cancellation**: Rep mic uses WebRTC AEC. Use headphones for cleanest Rep/Prospect separation.
- **No session persistence**: Transcripts and coaching live in memory. Stop or restart clears all state.
- **Coaching latency**: API adds 1–3s on top of transcription. Total end-to-end ~4–5s speech to suggestion.
- **Speaker ID by source**: Rep = mic stream, Prospect = display capture. Cross-talk within one stream not separated.
- **Deepgram reconnection**: Auto-reconnects with exponential backoff. Pre-drop transcript not replayed.

## Repository Structure

```
callwhisper/
├── server/
│   ├── index.js        Express + WS server, set_config / set_model handlers
│   ├── deepgram.js     Dual Deepgram Nova-2 streaming, unlimited reconnect
│   ├── transcript.js   Rolling 90s buffer, Rep/Prospect labels
│   └── coach.js        Gemini + Claude support, 8s throttle, 429 auto-fallback
├── client/
│   └── src/
│       ├── App.jsx     UI: transcript + coaching panels, API key inputs, model selector
│       └── capture.js  getUserMedia + getDisplayMedia, PCM encoding, dual WS senders
├── scripts/
│   └── test-audio.html Phase 0 device test
├── Dockerfile          Multi-stage: Vite build + node:20-slim runtime
├── docker-compose.yml  LXC 100 deployment (port 3003)
└── .env.example
```

## Built With

[Claude Code](https://claude.ai/code) — see `SESSION_LOG.md` for AI-assisted build log.
