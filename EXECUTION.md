# CallWhisper — 48h Execution Plan

Total: 48h. Bias: ship working, not polished.

---

## Phase 0 — Infrastructure + De-risk (0h–6h)

**Goal:** macOS VM running with audio, LXC 100 backend slot ready, prove two audio streams work.

### ✅ Task 0.1 — Create macOS VM on Proxmox (DONE — 2026-04-17)
1. Download macOS Sonoma installer via OSX-KVM fetch script (see MACOS_VM_SETUP.md)
2. Proxmox → Create VM (ID 102)
   - RAM: 4096MB, Disk: 50GB (local-lvm), CPU: 2 cores, vmbr0
   - BIOS: OVMF (UEFI), Machine: q35
3. Attach OpenCore ISO + macOS installer
4. Boot, install macOS (~45 min)
5. Verify: open YouTube, confirm audio output works
6. Install: `brew install blackhole-2ch`
7. Install Chrome, install Zoom

### Task 0.2 — Prepare LXC 100 backend slot (15 min)
1. SSH into LXC 100 (192.168.1.111)
2. Create `/root/callwhisper/` folder
3. Create placeholder `docker-compose.yml` (just Node image, no code yet)
4. Verify port 3001 not already in use

### Task 0.3 — Prove dual audio capture on macOS VM (1h)
1. Open Zoom on macOS VM, route speaker output → BlackHole in Zoom Audio Settings
2. Open `scripts/test-audio.html` in Chrome
3. Confirm Chrome sees both: built-in mic AND BlackHole as separate input devices
4. Confirm two simultaneous `MediaStream` objects active

### Dependencies
- Proxmox accessible, KVM enabled
- macOS Sonoma installer downloaded
- SSH access to LXC 100

### Risks
- OSX-KVM audio needs VirtIO or AC97 — may need config tweak
- BlackHole may not appear in Chrome device list → try restarting Chrome with `--use-fake-device-for-media-stream` disabled
- macOS install slow → start it and work on Task 0.2 in parallel

### Fallback
If VM audio broken after 4h → rent MacStadium Mac or switch to Chrome extension approach (no BlackHole needed)

### Definition of Done
Two active MediaStream objects in Chrome on macOS VM, one per audio source

---

## Phase 1 — Core Pipeline (6h–20h)

**Goal:** audio → Deepgram → transcript → Claude → coaching output visible in terminal/logs

### Step 1: Node.js backend skeleton (1h)
- `server/index.js` — Express + ws server on :3001
- Two WS endpoints: `/audio-rep`, `/audio-prospect`
- Logs incoming binary chunks to console
- Health check: `GET /health` → 200

### Step 2: Deepgram integration (2h)
- `server/deepgram.js`
- Open two Deepgram streaming WS connections on session start
- Pipe incoming audio binary to respective Deepgram connection
- Log transcript events: `[Rep] word word word`
- Handle WS reconnect (3 retries, exponential backoff)

### Step 3: Browser audio sender (2h)
- `client/capture.js`
- `enumerateDevices()` — list inputs, let user select mic + BlackHole
- `getUserMedia` on both devices
- `AudioWorkletNode` or `ScriptProcessorNode` → 16kHz mono PCM chunks
- Send chunks over WS to `/audio-rep` and `/audio-prospect`

### Step 4: Transcript aggregator (1h)
- `server/transcript.js`
- Collects Deepgram events from both streams
- Stamps each: `{speaker: "Rep"|"Prospect", text, timestamp}`
- Maintains rolling 90s array
- `getWindow()` → last 90s formatted for Claude

### Step 5: Claude coaching engine (2h)
- `server/coach.js`
- Reads transcript window every 8s
- Calls Claude API with sales coaching system prompt
- Returns `{say_this: "...", ask_this: "...", watch_out: "..."}`
- Throttle: skip call if no new transcript since last call
- Broadcast result to browser via `/events` WS

### Step 6: Wire + terminal test (1h)
- Start session on macOS VM, speak + play Zoom audio
- Verify terminal shows labeled transcript
- Verify coaching JSON appears every ~8s
- Check Deepgram partial latency < 2s

### Definition of Done
Terminal on LXC 100 shows `[Rep]` and `[Prospect]` lines + coaching JSON updating live

---

## Phase 2 — UI + Stabilization (20h–36h)

**Goal:** Browser UI showing live transcript + coaching, stable enough for demo

### Step 7: React UI (4h)
- `client/src/App.jsx`
- Start/Stop button → triggers capture.js
- Left panel: transcript list, each line `[Speaker HH:MM:SS] text`
- Right panel: latest coaching block (Say / Ask / Watch out)
- WS connection to `/events` on LXC 100
- Auto-scroll transcript panel

### Step 8: Stability pass (2h)
- WS reconnection from browser if backend drops
- Deepgram silence timeout handling
- Test with 5+ minutes continuous audio

### Step 9: End-to-end Zoom test on macOS VM (2h)
- Self-join Zoom (two accounts, two devices or Zoom test call: zoom.us/test)
- Verify both streams transcribing with correct labels
- Verify coaching appearing
- Fix any PCM format / sample rate issues

### Step 10: Simulated demo prep (1h)
- Record 3-min sales call audio file as fallback
- Can play via two VLC instances into virtual devices if live Zoom is flaky

### Definition of Done
Chrome on macOS VM shows live transcript + coaching during active Zoom call

---

## Phase 3 — Delivery (36h–48h)

**Goal:** Submit all required deliverables

### Step 11: README.md (1h)
### Step 12: Record demo video 3-5 min (2h)
### Step 13: Push to private GitHub repo, share with @serhatoptimum7 (30min)
### Step 14: Final submission checklist (30min)

See DELIVERY.md for full checklists and templates.
