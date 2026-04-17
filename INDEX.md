# CallWhisper — Project Index

All planning, execution, and delivery files for the 48h trial task.

## Planning & Architecture

| File | Purpose |
|------|---------|
| [PLAN.md](PLAN.md) | Master plan: task analysis, final architecture, MVP scope, risks, fallbacks |
| [EXECUTION.md](EXECUTION.md) | 48h execution plan: Phase 0→3, tasks, risks, definition of done per phase |
| [REPO_STRUCTURE.md](REPO_STRUCTURE.md) | Folder layout, dependencies, env vars, Docker setup, strict 10-step build order |
| [MACOS_VM_SETUP.md](MACOS_VM_SETUP.md) | Proxmox macOS VM setup guide (OSX-KVM, Sonoma 14, BlackHole) |

## Delivery

| File | Purpose |
|------|---------|
| [DELIVERY.md](DELIVERY.md) | Submission checklist, README outline, demo video script, known limitations text |
| [SESSION_LOG.md](SESSION_LOG.md) | Claude Code session log (required deliverable per SOW Section 4) |

## Source Code

| Path | Purpose |
|------|---------|
| [callwhisper/server/index.js](callwhisper/server/index.js) | Express + WS server, 3 endpoints |
| [callwhisper/server/deepgram.js](callwhisper/server/deepgram.js) | Dual Deepgram streaming connections |
| [callwhisper/server/transcript.js](callwhisper/server/transcript.js) | Rolling 90s transcript buffer |
| [callwhisper/server/coach.js](callwhisper/server/coach.js) | Claude coaching engine, 8s throttle |
| [callwhisper/client/src/App.jsx](callwhisper/client/src/App.jsx) | React UI: transcript + coaching panels |
| [callwhisper/client/src/capture.js](callwhisper/client/src/capture.js) | Dual getUserMedia, PCM chunking, WS sender |
| [callwhisper/scripts/test-audio.html](callwhisper/scripts/test-audio.html) | Phase 0 gate: dual audio device test |
| [callwhisper/docker-compose.yml](callwhisper/docker-compose.yml) | Docker deployment for LXC 100 |

## Current Status

- [x] Architecture decided: LXC 100 backend + VM 102 macOS
- [x] All backend code written (server/, Dockerfile, docker-compose)
- [x] Frontend code written (React UI, capture.js)
- [x] Phase 0 test script written
- [x] Push code to GitHub — https://github.com/batuhanboran/callwhisper (private)
- [x] Deploy backend to LXC 100 Docker — `192.168.1.111:3003` ✓
- [x] Cloudflare tunnel: callwhisper.batuhanboran.com → LXC 100:3003 ✓
- [x] QA pass: stale closure fix, WS reconnect, Deepgram keepalive, unlimited retries
- [x] Feature upgrades: objection_type, call_stage, prompt caching, talk ratio, coaching history
- [x] UI upgrades: stream indicators, audio level bars, coaching badges, session timer
- [x] README.md written + updated
- [x] SESSION_LOG.md updated (Sessions 1 + 2 + 3 + 4)
- [x] VM 102 (macOS Sonoma) — installed, macOS Sonoma 14.8.5 running, account macpc/1234
- [ ] Add @serhatoptimum7 as GitHub collaborator (GitHub Settings → Collaborators)
- [x] Phase 0 audio test on macOS VM — PASSED (two streams, BlackHole detected)
- [x] Chrome + Zoom installed on macOS VM
- [x] SSH key auth configured (macpc@192.168.1.110, no password)
- [ ] End-to-end Zoom test
- [ ] Demo video recording
- [ ] Submit
