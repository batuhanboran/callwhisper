# CallWhisper — Claude Code Session Log

AI-assisted development log. Required deliverable per SOW Section 4:
> "If using AI-assisted development tools (Claude Code, Cursor, etc.), share session logs or a short screen recording of the build process."

---

## Session 1 — 2026-04-17 (Planning + Full Backend Build)

**Tool:** Claude Code (claude-sonnet-4-6) via CLI  
**Duration:** ~2h  
**Mode:** Caveman (compressed) + Context-mode (context-efficient tool use)

### What Claude Code Did

**1. Read and analyzed the SOW PDF**
- Extracted minimum pass bar (4 items)
- Separated MVP requirements from full-project items
- Identified evaluation criteria

**2. Architecture decisions made with Claude:**
- Compared 5 architecture options (local web, Electron, Swift, Chrome extension, hybrid)
- Decided: Node.js backend on LXC 100 Docker + React browser frontend on macOS VM
- Identified macOS requirement from SOW Section 5
- Solved: no physical Mac available → macOS Sonoma VM on Proxmox (OSX-KVM)
- Decided: skip new LXC 102, use existing LXC 100 Docker (already has Cloudflare tunnel)
- Confirmed: LXC 100 (Linux) backend communicates to macOS VM over LAN — OS irrelevant for server

**3. Infrastructure design:**
- LXC 100 existing Docker + new callwhisper service
- Cloudflare tunnel → `callwhisper.batuhanboran.com` (same pattern as n8n.batuhanboran.com)
- macOS VM 102 on Proxmox (vmbr0, same LAN bridge)
- WebSocket: macOS Chrome → `ws://192.168.1.111:3001` (LAN)

**4. Planning documents created:**
- `INDEX.md` — master project index
- `PLAN.md` — full architecture + MVP scope + risks + fallbacks
- `EXECUTION.md` — 4-phase 48h execution plan
- `REPO_STRUCTURE.md` — build order, folder structure, env vars, Docker
- `MACOS_VM_SETUP.md` — OSX-KVM Proxmox setup guide
- `DELIVERY.md` — submission checklist, README template, demo script

**5. Full backend code written by Claude Code:**

| File | Lines | Description |
|------|-------|-------------|
| `server/index.js` | ~70 | Express + 3 WS servers, upgrade routing |
| `server/deepgram.js` | ~100 | Deepgram Nova-2 streaming, reconnect logic |
| `server/transcript.js` | ~40 | Rolling buffer, window query, new-content detection |
| `server/coach.js` | ~90 | Claude claude-sonnet-4-6, sales coaching prompt, 8s throttle |
| `client/src/App.jsx` | ~160 | React UI, dual panels, device selection, WS events |
| `client/src/capture.js` | ~70 | getUserMedia, float32→int16 PCM, dual WS senders |
| `client/src/main.jsx` | 5 | React entry |
| `client/index.html` | 15 | HTML shell |
| `client/vite.config.js` | 20 | Vite + WS proxy to LXC 100 |
| `client/package.json` | 20 | React 18 + Vite 5 |
| `package.json` | 18 | Express, ws, @deepgram/sdk, @anthropic-ai/sdk |
| `Dockerfile` | 9 | node:20-slim, production build |
| `docker-compose.yml` | 14 | LXC 100 deployment |
| `.env.example` | 5 | All required env vars |
| `.gitignore` | 6 | Standard ignores |
| `scripts/test-audio.html` | ~130 | Phase 0 device enumeration + dual capture test |

**6. Docker MCP enabled:**
- Found `proxmox-docker` defined in `.claude/.mcp.json`
- Added to `enabledMcpjsonServers` in `settings.local.json`
- Active on next session restart

### Key Decisions Logged

| Decision | Chosen | Reason |
|----------|--------|--------|
| Backend location | LXC 100 Docker | Already has Docker + Cloudflare tunnel |
| macOS source | Proxmox VM (OSX-KVM) | No physical Mac available |
| Audio capture | BlackHole-2ch + getUserMedia | Free, browser-compatible, standard approach |
| Transcription | Deepgram Nova-2 streaming | Lowest latency, best accuracy, SOW recommended |
| LLM | Claude claude-sonnet-4-6 | SOW preferred, structured JSON output |
| Speaker labeling | By stream source | Stream 1 = Rep, Stream 2 = Prospect (no diarization needed) |
| UI framework | React + Vite | Fast to build, Vite proxy handles WS in dev |

### Risks Identified

1. **macOS VM audio** — VirtIO audio may need manual Proxmox config (`ich9-intel-hda`)
2. **BlackHole in Chrome VM** — may need audio daemon restart
3. **Deepgram PCM format** — must be linear16, 16kHz, mono (implemented correctly)
4. **Claude JSON parsing** — regex fallback in coach.js handles backtick-wrapped JSON

---

## Session 2 — 2026-04-17 (Deployment + GitHub)

**Tool:** Claude Code (claude-sonnet-4-6) via CLI  
**Duration:** ~1h  
**Mode:** Caveman Ultra + Context-mode

### What Claude Code Did

**1. Diagnosed infrastructure via proxmox-docker MCP**
- SSH landed on Proxmox host (`pve`, 192.168.1.111) not LXC directly
- Confirmed LXC 100 running, Docker 29.3.1 installed, accessible via `pct exec 100`
- Found ports 3001 (rss-bridge) and 3002 already allocated → chose **3003**

**2. Fixed Dockerfile for zero-dependency build**
- Original: single-stage, required pre-built `client/dist/` on host
- Updated: multi-stage (Stage 1: Vite build inside Docker, Stage 2: node:20-slim runtime)
- Changed `npm ci` → `npm install` (no package-lock.json present)

**3. Deployed to LXC 100**
- Packaged source as tar (12KB), SCP to Proxmox host, piped via `pct exec 100 -- tar`
- Created `.env` on LXC 100 with real API keys
- `docker compose up --build -d` → built Vite client (~5min), container started
- Health check: `{"status":"ok"}` at `192.168.1.111:3003/health` ✓

**4. GitHub repo**
- `git init`, staged 24 files (`.env` excluded by .gitignore ✓)
- Created repo: https://github.com/batuhanboran/callwhisper (private)
- Pulled GitHub README, merged, pushed all files

**5. Fixed vite.config.js proxy**
- Updated WS proxy target: `ws://192.168.1.111:3001` → `ws://192.168.1.111:3003`

**6. Documentation pass**
- Wrote full README.md (architecture, setup, limitations)
- Updated INDEX.md (deployment status)
- Fixed REPO_STRUCTURE.md (port, Dockerfile)
- Updated SESSION_LOG.md

### Key Decisions

| Decision | Chosen | Reason |
|----------|--------|--------|
| Host port | 3003 | 3001 + 3002 already allocated on LXC 100 |
| Dockerfile | Multi-stage | No Node.js outside Docker on LXC 100 |
| Build approach | Docker build | Avoids local npm/node dependency on deploy machine |
| Cloudflare tunnel | CF dashboard (manual) | Token-based tunnel, no local ingress config |

### Remaining (VM 102 dependent)
- Phase 0 audio test (BlackHole + Chrome dual stream)
- End-to-end Zoom test
- Demo video recording

---

## Session 3 — (Stabilization)

_Will cover: UI fixes, reconnection testing, demo prep_

---

## Session 4 — (Delivery)

_Will cover: README, demo video, final repo push, submission_
