# CallWhisper — 48h Trial Master Plan

## 1. What the Task Really Is

Build `capture → transcribe → coach` loop for live Zoom calls on macOS.

### Minimum Pass Bar (ALL FOUR required)
1. Two audio streams captured separately (mic = Rep, system audio = Prospect)
2. Live transcript with correct speaker labels, partial latency < 2s
3. At least ONE coaching suggestion type (Say this / Ask this / Watch out) in real time
4. Working demo on real OR simulated Zoom call, delivered in 48h

### Evaluation Criteria
- Audio capture quality, speaker label accuracy
- Transcription accuracy under real conversation
- Coaching suggestions useful for sales (not generic)
- Clean architecture: capture / transcription / AI layers separated
- Speed of delivery
- AI tooling workflow visible (Claude Code session logs)

### NOT Needed for This Trial
- RAG / knowledge base
- Objection classification
- Post-call scoring
- Pre-call research
- Multi-agent orchestration
- Admin panel / fancy UI
- Scoring engine

---

## 2. Final Architecture

```
Proxmox Host (192.168.1.111)
├── LXC 100 — public-services (existing)
│   └── Docker: add callwhisper-backend container
│       - Node.js server
│       - Two Deepgram WebSocket connections
│       - Claude API coaching engine
│       - Exposes :3001
│       - Cloudflare tunnel already here → callwhisper.batuhanboran.com
│
└── VM 102 — macOS Sonoma (NEW)
    - Chrome browser (UI + audio capture)
    - Zoom app
    - BlackHole-2ch virtual audio driver
    - Connects to LXC 100 backend via LAN: ws://192.168.1.111:3001
```

### Why this split
- macOS required by PDF (Section 5: "Platform: macOS")
- Audio capture MUST be macOS — mic and BlackHole are macOS hardware/driver
- Backend is just a server — Linux fine, OS irrelevant
- LXC 100 already has Docker + Cloudflare tunnel — zero extra infra needed
- VM 102 communicates to LXC 100 over LAN (same vmbr0 bridge, sub-1ms latency)
- No LXC 102 needed — LXC cannot run macOS (shares Linux kernel)

---

## 3. What Runs Where

| Component | Where | Notes |
|-----------|-------|-------|
| UI (browser) | VM 102 macOS | Chrome on macOS |
| Start/Stop control | VM 102 macOS | Browser button |
| Mic capture | VM 102 macOS | `getUserMedia` — MUST be macOS |
| System audio (Zoom) | VM 102 macOS | BlackHole → second input — MUST be macOS |
| Audio chunk transport | VM 102 → LXC 100 | `ws://192.168.1.111:3001` via LAN |
| WebSocket relay | LXC 100 (Docker) | Node.js receives chunks |
| Deepgram connections | LXC 100 → Deepgram cloud | Two parallel WS |
| Transcript aggregation | LXC 100 | In-memory rolling buffer |
| Claude coaching engine | LXC 100 → Claude cloud | Throttled every 8s |
| Public URL (optional) | Cloudflare tunnel on LXC 100 | `callwhisper.batuhanboran.com` |
| Logs/persistence | SKIP MVP | Console only |

---

## 4. MVP Scope

### Build
- **Backend** (Docker service on LXC 100):
  - Node.js + Express + ws
  - Two Deepgram streaming WebSocket connections
  - Rolling 90s transcript buffer with Rep/Prospect labels
  - Claude API call every 8s → `{say_this, ask_this, watch_out}`
  - Broadcasts events to browser via WebSocket

- **Frontend** (served from LXC 100 or local vite):
  - Start/Stop button
  - `getUserMedia` for mic + BlackHole device
  - Sends PCM chunks to backend over WebSocket
  - Left panel: live transcript with labels + timestamps
  - Right panel: coaching suggestions, newest on top

### Simplify / Fake
- Speaker diarization: label by source (stream 1 = Rep, stream 2 = Prospect) — no Deepgram diarize needed
- Session persistence: none, in-memory only
- UI: functional only, zero polish
- Reconnection: basic retry, not production-grade

### NOT Building
- Auth, database, RAG, objection taxonomy, admin panel, scoring, multi-call

---

## 5. Biggest Technical Risk

**YES — audio capture is hardest.** macOS VM complicates it further.

macOS VM on Proxmox (OSX-KVM) must:
1. Have working audio output (VirtIO or AC97)
2. Support BlackHole-2ch installation via brew
3. Allow Chrome to access both mic AND BlackHole simultaneously

**Prove first:**
1. macOS VM boots and has audio (play a YouTube video — hear it)
2. BlackHole installs and appears in System Settings → Sound
3. `scripts/test-audio.html` — two simultaneous getUserMedia streams work in Chrome

**Prove second:**
4. Deepgram receives audio chunks and returns transcript < 2s

**Don't touch until proven:**
- Claude coaching
- React UI
- Any deployment config

---

## 6. Fallback Options (Audio Capture)

**Fallback 1 — Chrome extension (if BlackHole fails in VM):**
- Chrome extension captures Zoom web client tab audio
- No BlackHole needed
- Demo uses Zoom web, not Zoom desktop app

**Fallback 2 — Simulate streams for demo:**
- Play pre-recorded sales call audio through two virtual devices
- Proves pipeline works even if live VM audio is broken
- Use only if VM audio completely unusable at demo time

**Fallback 3 — Rent real Mac:**
- MacStadium or AWS Mac instance (~$0.15/hr)
- If OSX-KVM VM has persistent audio issues
- Nuclear option, use if VM wastes > 6h

---

## 7. Infrastructure Setup

### VM 102 — macOS Sonoma
- Proxmox → Create VM (not CT)
- OS: macOS Sonoma 14 via OSX-KVM / OpenCore
- RAM: 4GB, Disk: 50GB, CPU: 2 cores, Network: vmbr0
- After boot: `brew install blackhole-2ch`, install Chrome, install Zoom

### LXC 100 — Add callwhisper-backend Docker service
- Add to existing `/root/n8n-setup/docker-compose.yml`
- Or create `/root/callwhisper/docker-compose.yml` separately
- Expose port 3001
- Add Cloudflare tunnel ingress: `callwhisper.batuhanboran.com` → `http://localhost:3001`

---

## 8. Short Architecture Explanation for Demo

> "The browser on macOS captures two audio streams simultaneously — rep's mic and Zoom system audio via BlackHole virtual routing. Audio chunks stream over WebSocket to a Node.js backend running in Docker on a Linux server on the same network. The backend maintains two parallel Deepgram connections for real-time transcription under 2 seconds, then feeds the rolling transcript into Claude every 8 seconds. Claude returns structured sales coaching — what to say, what to ask, what to watch out for — displayed live in the browser."
