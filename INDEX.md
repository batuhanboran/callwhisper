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

- [x] Architecture: LXC 100 backend + VM 102 macOS + Windows Chrome demo
- [x] Backend: server/, Dockerfile, docker-compose
- [x] Frontend: React UI, capture.js (getDisplayMedia + getUserMedia)
- [x] Deployed: callwhisper.batuhanboran.com (Cloudflare → LXC 100:3003) ✓
- [x] Transcription: Rep/Prospect labels live, < 2s latency ✓
- [x] AI coaching: Gemini 2.5 Flash live ✓ + Claude support added
- [x] Rate limit handling: 429 auto-fallback chain (4 Gemini models)
- [x] Model selector: live during session, 8 models (Gemini + Claude)
- [x] API keys: entered in UI, saved to localStorage, override .env
- [x] Audio capture: getDisplayMedia (no virtual driver needed) + BlackHole fallback
- [x] Echo cancellation on Rep mic (prevents speaker bleed)
- [x] Stop clears transcript + coaching (clean per-session state)
- [x] Error banner: shows 429/fallback/error details in red banner
- [x] Editable speaker names (Rep / Prospect labels)
- [x] Security: no hardcoded secrets, .env gitignored, WS input validated
- [x] SESSION_LOG.md: Sessions 1–7 complete
- [x] README.md updated (getDisplayMedia, Claude, key fields, current architecture)
- [ ] Add @serhatoptimum7 as GitHub collaborator (GitHub Settings → Collaborators)
- [ ] Demo video recording (3–5 min)
- [ ] Submit
