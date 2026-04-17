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

## Session 3 — 2026-04-17 (QA Pass + Feature Upgrades)

**Tool:** Claude Code (claude-sonnet-4-6) via CLI  
**Duration:** ~2h  
**Mode:** Caveman + Context-mode

### What Claude Code Did

**1. Full code audit — bugs found and fixed**

| Bug | File | Fix |
|-----|------|-----|
| Stale React closure | `App.jsx` | `runningRef = useRef(false)` synced alongside `setRunning`; `connectEvents` uses `runningRef.current`, no deps array |
| Deepgram 3-retry limit | `deepgram.js` | Changed to unlimited retries, exponential backoff capped at 30s |
| No audio keepalive | `deepgram.js` | Added `keepAlive()` call every 8s to prevent Deepgram idle timeout |
| WS silent drop (capture) | `capture.js` | Added reconnect loop with `Math.min(10s, 500 * 2^attempts)` backoff |
| No stream visibility | `App.jsx` | `stream_status` events now update per-speaker status indicators |

**2. Backend feature additions (SOW alignment)**

- **Objection classification**: `coach.js` now outputs `objection_type` field — values: `price / timing / authority / competitor / feature / null`
- **Call stage detection**: new `call_stage` field — values: `opening / discovery / demo / objection / closing / null`
- **Prompt caching**: system prompt marked `cache_control: { type: 'ephemeral' }` + `anthropic-beta: prompt-caching-2024-07-31` header → saves ~70% of system prompt tokens on repeated calls
- **Critical moment fast path**: `watch_out` payload triggers re-coach in 3s instead of 8s
- **Talk stats**: `transcript.getTalkStats()` returns word count + entry count per speaker; broadcast every 10s
- **Coaching history**: `coach.getHistory()` stores last 5 snapshots; replayed to new events clients on reconnect

**3. Frontend feature additions**

- `StreamIndicator` component: colored dot (green=connected, yellow=reconnecting, red=error) + live audio level bar (0–100, updates every 200ms via AnalyserNode)
- Talk ratio bar: Rep vs Prospect word counts shown as percentage bar
- Coaching badges: `call_stage` + `objection_type` shown on each coaching card
- Coaching history panel: last 5 suggestions, newest on top (SOW Section 3 requirement)
- Session timer: elapsed time shown in header
- Per-speaker Deepgram stream status shown in header

**4. Documentation pass**
- README.md: architecture diagram updated with 3s bypass footnote; reconnect limitation text fixed
- DELIVERY.md: demo script updated for new UI features
- INDEX.md: status updated

### Key Changes vs Session 1/2

| Area | Before | After |
|------|--------|-------|
| Coaching output fields | `say_this / ask_this / watch_out` | + `objection_type` + `call_stage` |
| Deepgram reconnect | 3 retries | Unlimited, exp backoff capped 30s |
| Stream status | No visibility | Per-speaker dot + level bar |
| React closure | Stale `running` state | `runningRef` fix |
| Prompt cost | Full system prompt every call | Cached after first call |

---

## Session 4 — 2026-04-17 (macOS VM 102 Install)

**Tool:** Claude Code (claude-sonnet-4-6) via CLI
**Duration:** ~1.5h
**Mode:** Caveman Ultra + Context-mode

### What Claude Code Did

**1. Diagnosed VM 102 config vs reference guide**
- SSHed into PVE host (192.168.1.111), read `/etc/pve/qemu-server/102.conf`
- Fetched nicksherlock Ventura/Proxmox guide for comparison
- Found 3 critical errors in original config

**2. Bugs found and fixed**

| Bug | Fix |
|-----|-----|
| Missing `-device isa-applesmc,osk="..."` | Added OSK from OSX-KVM project |
| Missing `-smbios type=2` | Added to args |
| OpenCore mounted as `media=cdrom` | Changed to `cache=unsafe`, moved to VM images dir |
| `cpu: kvm64` | Changed to `cpu: host` |
| OpenCore in ISO store (Proxmox rejects non-cdrom) | Copied to `/var/lib/vz/images/102/vm-102-disk-3.raw` |

**3. macOS Sonoma 14.8.5 installed**
- VM started successfully with fixed config
- Booted into macOS Recovery → Disk Utility → formatted 64GB VirtIO as APFS "Macintosh HD"
- Ran "Reinstall macOS Sonoma" → 2-3 reboots → setup wizard
- Created account: `macpc` / `1234`
- macOS desktop reached ✓

### Account & Config Reference
- **VM ID:** 102, PVE host: 192.168.1.111
- **macOS user:** macpc / 1234
- **OpenCore:** `vm-102-disk-3.raw` (OpenCore-custom.img, 150MB)
- **Main disk:** `vm-102-disk-1.qcow2` (64GB, Macintosh HD APFS)

### Remaining
- Install Homebrew + BlackHole-2ch
- Install Chrome + Zoom
- Phase 0 audio test
- End-to-end Zoom test + demo video

---

## Session 5 — 2026-04-17 (macOS VM Setup + Phase 0 Pass)

**Tool:** Claude Code (claude-sonnet-4-6) via CLI  
**Duration:** ~1.5h  
**Mode:** Caveman Ultra + Context-mode

### What Claude Code Did

**1. Fixed VM 102 audio device**
- VM had no audio device → BlackHole install would work but no audio passthrough
- Added via PVE: `qm set 102 -audio0 device=ich9-intel-hda,driver=none`
- Note: `driver=spice` fails — VM uses vmware VGA, not SPICE display

**2. SSH key auth configured for macOS VM**
- Generated `~/.ssh/id_ed25519` on Windows dev machine
- Copied public key to `macpc@192.168.1.110:~/.ssh/authorized_keys`
- No more password prompts for macOS VM SSH

**3. Installed Homebrew on macOS VM**
- Path: `/usr/local/bin/brew` (Intel Mac — NOT `/opt/homebrew`)
- Used `NONINTERACTIVE=1` + pre-cached sudo credentials via `-tt` SSH

**4. Installed BlackHole-2ch**
- Brew cask install requires passwordless sudo (installer runs as root)
- Fixed: added `macpc ALL=(ALL) NOPASSWD: ALL` to `/etc/sudoers`
- Install successful: `BlackHole2ch-0.6.1.pkg` installed, VM rebooted

**5. Installed Chrome + Zoom**
- Chrome: downloaded `.pkg` via curl, installed with `sudo installer`
- Zoom: downloaded `ZoomInstallerIT.pkg`, installed same way

**6. Phase 0 audio test — PASSED ✓**
- Served `test-audio.html` from macOS VM via `python3 -m http.server 8080`
- Opened `http://localhost:8080/test-audio.html` in Chrome on VM (noVNC)
- Both streams detected: mic + BlackHole 2ch
- Audio level detected on BlackHole stream when playing audio
- **Phase 0 gate passed — two simultaneous MediaStream objects confirmed**

**7. Confirmed backend healthy**
- PVE SSH key: `C:\Users\BaronPC\ProxmoxMCP\ssh_key` → connects to PVE host
- `pct exec 100 -- docker ps` → `callwhisper-backend: Up 13h`
- Health check: `{"status":"ok"}` at `localhost:3003/health` ✓

### Key Infrastructure Notes

| Item | Detail |
|------|--------|
| PVE host SSH | `ssh -i C:\Users\BaronPC\ProxmoxMCP\ssh_key root@192.168.1.111` |
| macOS VM SSH | `ssh macpc@192.168.1.110` (key auth, no password) |
| LXC 100 exec | `pct exec 100 -- <command>` from PVE host |
| Brew path (Intel) | `/usr/local/bin/brew` |
| BlackHole pkg | `/usr/local/Caskroom/blackhole-2ch/0.6.1/BlackHole2ch-0.6.1.pkg` |
| noVNC audio | Not supported — browser VNC has no audio channel |

### Remaining
- Gemini coaching verified live (active session test)
- Demo video recording
- Add @serhatoptimum7 as GitHub collaborator
- Submit

---

## Session 6 — 2026-04-17 (E2E Test + Gemini Switch + QA)

**Tool:** Claude Code (claude-sonnet-4-6) via CLI  
**Duration:** ~2h  
**Mode:** Caveman Ultra + Context-mode

### What Claude Code Did

**1. End-to-end transcription test — PASSED**
- Diagnosed: Rep stream silent (VM mic = virtual, `driver=none` = no input)
- Solution: macOS system output → BlackHole (via `SwitchAudioSource` SSH), both Rep + Prospect = BlackHole
- Played YouTube sales call video → both streams transcribed live ✓
- Fallback 2 from PLAN.md — proves full pipeline end-to-end

**2. Diagnosed Anthropic API failure**
- `[Coach] Error: 400 credit balance too low` — Anthropic account has $0
- Switched coaching engine to **Gemini 2.0 Flash** (free tier, 15 RPM, 1M TPM)
- User's key: Google AI Studio (gemini API key)

**3. Coaching engine migration**
- Replaced `@anthropic-ai/sdk` with `@google/generative-ai` in `package.json`
- Rewrote `coach.js` — `GoogleGenerativeAI`, `systemInstruction`, same output schema
- Added `setModel(model)` method
- `.env.example`: `ANTHROPIC_API_KEY` → `GEMINI_API_KEY`

**4. Model selector UI**
- `App.jsx`: dropdown with 4 Gemini models (default: `gemini-2.0-flash`)
- `coachModelRef` (useRef) synced via `useEffect` — fixes stale closure bug
- Events WS `onopen` sends `{type: 'set_model', model}` immediately
- Backend `index.js` handles `set_model` message, validates against `ALLOWED_MODELS` Set

**5. Transcript UX improvements**
- Newest transcript lines appear at TOP (no scrolling)
- Max 100 lines in state (memory bound)
- Removed auto-scroll ref

**6. Full QA pass — 8 bugs found and fixed**

| Bug | File | Fix |
|-----|------|-----|
| Stale `coachModel` closure | `App.jsx` | `coachModelRef` synced via `useEffect` |
| Concurrent coach ticks | `coach.js` | `_ticking` flag + `finally` reset |
| No Gemini 429/503 retry | `coach.js` | Auto-retry 15s/5s respectively |
| `send()` can throw | `deepgram.js` | try/catch, resets `isConnected` |
| No Deepgram Warning log | `deepgram.js` | `LiveTranscriptionEvents.Warning` handler |
| Double-click start | `App.jsx` | `if (running) return` guard |
| WS reconnect race | `App.jsx` | Close existing WS before opening new |
| Level interval leak | `capture.js` | Clear `levelInterval` on WS close when stopped |
| `ALLOWED_MODELS` per-connection | `index.js` | Moved to module-level `Set` |

**7. Security review**
- No hardcoded secrets in any file ✓
- `.env` in `.gitignore` ✓
- No sensitive filenames committed ✓
- `ALLOWED_MODELS` whitelist prevents arbitrary model injection ✓
- WS message capped at 512 bytes ✓
- CORS open (`*`) — acceptable for demo ✓

**8. Documentation pass**
- README: all Anthropic/Claude refs → Gemini
- INDEX.md: updated all completed checkboxes
- SESSION_LOG.md: Session 5 + 6 logged

### Remaining
- Add @serhatoptimum7 as GitHub collaborator
- Record 3–5 min demo video
- Submit

---

## Session 7 — 2026-04-17 (Audio Routing + Full Feature Polish)

**Tool:** Claude Code (claude-sonnet-4-6) via CLI
**Duration:** ~4h
**Focus:** Windows audio routing, getDisplayMedia capture, model selector live, Claude support, UI polish, QA

### Tasks Completed

**1. Audio capture overhaul**
- Replaced BlackHole-only approach with `getDisplayMedia` for Prospect stream
- No virtual audio driver required — works natively on Windows and macOS
- User picks Zoom/YouTube tab in Chrome share dialog, checks "Share tab audio"
- Fallback: BlackHole/VB-Cable still available via device dropdown
- Echo cancellation enabled on Rep mic (`echoCancellation: true`) to prevent speaker bleed

**2. Windows audio routing (VB-Audio Cable)**
- Installed VB-Cable on Windows host via SoundVolumeView CLI
- Diagnosed CABLE Output not showing in Chrome → enabled via SoundVolumeView
- Routed Chrome audio to CABLE Input for Prospect capture
- Superseded by getDisplayMedia approach (no VB-Cable needed)

**3. Gemini model fixes**
- Fetched actual model list from Gemini API → confirmed valid IDs
- Fixed `detect_language: true` (invalid for streaming) → reverted to `language: env || 'en-US'`
- Added `FALLBACK_CHAIN`: 429 auto-switches `2.5-flash → 2.5-flash-lite → 2.0-flash → 2.0-flash-lite`
- Backend broadcasts `model_changed` event → UI dropdown syncs automatically
- Model selector enabled during live session (was disabled before)

**4. Claude / Anthropic support**
- Added `@anthropic-ai/sdk` to dependencies
- `coach.js` detects model prefix (`claude` vs `gemini`) → routes to correct SDK
- UI: separate optgroups "Gemini (free tier)" and "Claude (Anthropic key)"
- Models: Claude Haiku 4.5, Claude 3.5 Haiku, Claude Sonnet 4.6

**5. API key fields in UI**
- Two password inputs in header: Deepgram key + Gemini/Claude key
- Keys sent via `set_config` WebSocket message on session start
- Saved to `localStorage` for convenience (not re-entered each visit)
- Backend falls back to `.env` keys if UI fields empty
- WS message cap raised to 2048 bytes to accommodate keys

**6. UX improvements**
- Stop session clears transcript + coaching history (fresh state per session)
- Speaker names editable (default "Rep (You)" / "Prospect (Caller)")
- Transcript lines: colored left-border + subtle tint per speaker
- All-null coaching responses skipped (no phantom empty cards)
- Old coaching entries: opacity 0.6 (was 0.4 — too dark)
- Error banner (red, auto-dismiss 8s) for 429/500/503 + unknown errors
- Model fallback shown in error banner with new model name

**7. Bug fixes**
| Bug | Fix |
|-----|-----|
| `detect_language: true` → Deepgram 400 | Reverted to `language` param |
| getDisplayMedia video track not stopped | `displayStream.getVideoTracks().forEach(t => t.stop())` |
| Rep mic picking up YouTube via speakers | `echoCancellation: true` on getUserMedia |
| Prospect CABLE Output not in Chrome | Enabled via SoundVolumeView |
| Model selector disabled during session | Removed `disabled={running}`, sends `set_model` live |

### Key Decisions

| Decision | Chosen | Reason |
|----------|--------|--------|
| Prospect capture | `getDisplayMedia` | No virtual audio driver, works Windows/macOS, user picks exact tab |
| Multi-model | Gemini primary + Claude optional | Free tier for demo, Claude for production |
| Keys in UI | Yes, with localStorage | Demo-friendly, no .env file required at demo time |
| Clear on stop | Yes | Clean slate per session, avoids confusion in demo |

### Files Modified
- `client/src/capture.js` — getDisplayMedia for Prospect, echoCancellation on Rep
- `client/src/App.jsx` — key fields, Claude models, clear on stop, model sync, editable names, error banner
- `server/coach.js` — Claude SDK, fallback chain, auto model switch, dynamic key update
- `server/deepgram.js` — `updateKey()` method
- `server/index.js` — `set_config` handler, ALLOWED_MODELS updated, WS cap 2048
- `package.json` — `@anthropic-ai/sdk` added
- `README.md` — full rewrite reflecting new capture approach + features
- `DELIVERY.md` — minimum bar items all checked
