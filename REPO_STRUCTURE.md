# CallWhisper — Repository Structure & Build Order

## Folder Structure

```
callwhisper/
├── server/
│   ├── index.js          # Express + WS server, entry point
│   ├── deepgram.js       # Two Deepgram streaming WS connections
│   ├── transcript.js     # Rolling buffer, speaker labeling
│   └── coach.js          # Claude API, throttling, coaching output
├── client/
│   ├── index.html
│   └── src/
│       ├── App.jsx       # Main UI: transcript panel + coaching panel
│       └── capture.js    # getUserMedia (mic + BlackHole), PCM chunking, WS sender
├── scripts/
│   └── test-audio.html   # Phase 0 proof: enumerate devices, dual capture
├── docker-compose.yml    # Runs on LXC 100
├── Dockerfile
├── .env.example
├── .gitignore            # includes .env
└── README.md
```

## Dependencies

### Backend
```json
{
  "dependencies": {
    "express": "^4.18",
    "ws": "^8.14",
    "@deepgram/sdk": "^3",
    "@anthropic-ai/sdk": "^0.24",
    "dotenv": "^16",
    "cors": "^2.8"
  }
}
```

### Frontend
```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18"
  },
  "devDependencies": {
    "vite": "^5",
    "@vitejs/plugin-react": "^4"
  }
}
```

Minimal. No ORM, no database, no auth, no state lib.

## Environment Variables

```bash
# .env — lives on LXC 100, never committed
DEEPGRAM_API_KEY=
ANTHROPIC_API_KEY=
PORT=3001
COACHING_INTERVAL_MS=8000
TRANSCRIPT_WINDOW_S=90

# client/.env — build-time Vite env
VITE_BACKEND_WS=ws://192.168.1.111:3001     # LAN (VM 102 → LXC 100)
# VITE_BACKEND_WS=wss://callwhisper.batuhanboran.com  # public via Cloudflare
```

## Docker Setup (LXC 100)

```yaml
# docker-compose.yml
version: '3.8'
services:
  callwhisper:
    build: .
    container_name: callwhisper-backend
    restart: unless-stopped
    ports:
      - "3003:3001"
    env_file: .env
    networks:
      - default
```

```dockerfile
# Dockerfile — multi-stage (Stage 1: Vite build, Stage 2: production runtime)
FROM node:20-slim AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server/ ./server/
COPY --from=client-builder /app/client/dist ./client/dist/
EXPOSE 3001
CMD ["node", "server/index.js"]
```

Deploy cycle from Windows dev machine:
```bash
git push origin main
ssh root@192.168.1.111 "cd /root/callwhisper && git pull && docker compose up -d --build"
```

## Architecture Boundaries

```
macOS VM 102 (Chrome browser)
  ├── mic stream ──────────────────────────┐
  └── BlackHole stream (Zoom audio) ───────┤
                                           ↓ WebSocket (ws://192.168.1.111:3001)
                              LXC 100 — callwhisper Docker container
                                ├── /audio-rep WS   → Deepgram WS (Rep)
                                ├── /audio-prospect → Deepgram WS (Prospect)
                                ├── transcript.js   → rolling 90s buffer
                                └── coach.js        → Claude API every 8s
                                           ↓ WebSocket /events
                              macOS VM 102 (Chrome browser)
                                ├── Left panel:  live transcript
                                └── Right panel: coaching suggestions
```

---

## Build Order (strict — do in this sequence)

### Step 1 — `scripts/test-audio.html`
**Create:** 30-line HTML. Enumerate devices. Open two getUserMedia streams simultaneously.
**Success:** Console shows two active MediaStream objects, one mic, one BlackHole.

### Step 2 — `server/index.js`
**Create:** Express + ws. Two WS endpoints (`/audio-rep`, `/audio-prospect`). `/health` route. Log incoming chunks.
**Success:** `wscat -c ws://192.168.1.111:3001/audio-rep` connects and stays open.

### Step 3 — `server/deepgram.js`
**Create:** Open two Deepgram Nova-2 streaming connections. Pipe binary from WS to Deepgram. Log transcript events.
**Success:** Speak into mic → terminal shows `[Rep] word word word` within 2s.

### Step 4 — `client/capture.js`
**Create:** getUserMedia on mic + BlackHole. AudioWorklet → 16kHz mono PCM. Send chunks over WS.
**Success:** Backend logs show chunks arriving from both streams.

### Step 5 — `server/transcript.js`
**Create:** Collect Deepgram events, stamp speaker, maintain 90s rolling array. `getWindow()` returns formatted string.
**Success:** `transcript.getWindow()` returns labeled multi-turn conversation string.

### Step 6 — `server/coach.js`
**Create:** Read transcript window, call Claude claude-sonnet-4-6, return `{say_this, ask_this, watch_out}` JSON. Throttle 8s. Broadcast via `/events`.
**Success:** Every 8s, browser receives coaching JSON with sales-relevant suggestions.

### Step 7 — `client/src/App.jsx`
**Create:** React. Start/Stop. WS to `/events`. Left panel transcript. Right panel coaching.
**Success:** UI updates live during active audio session.

### Step 8 — End-to-end Zoom test
**Run:** Full stack during Zoom call (or zoom.us/test). Verify all 4 minimum bar items.
**Success:** All four pass bar checkboxes satisfied.

### Step 9 — Dockerfile + docker-compose.yml
**Create:** Containerize backend. Deploy to LXC 100.
**Success:** `docker compose up -d` on LXC 100, macOS VM connects, full pipeline works.

### Step 10 — README + demo video + repo
**Create:** Delivery assets per DELIVERY.md.
**Success:** Repo shared, video uploaded, submission complete.
