# CallWhisper — Delivery Checklist & Assets

## Submission Checklist

### Required Deliverables
- [x] Private GitHub repo created — https://github.com/batuhanboran/callwhisper
- [ ] Repo shared with @serhatoptimum7 — add via GitHub Settings → Collaborators
- [x] README.md with setup instructions
- [x] README.md with architecture decisions
- [x] README.md with known limitations
- [ ] 3–5 min demo video showing tool working on test call
- [x] AI session logs (SESSION_LOG.md — Sessions 1 + 2 + 3 + 4 complete)

### Minimum Pass Bar
- [ ] Two audio streams captured separately (mic = Rep, system audio = Prospect)
- [ ] Live transcript with correct Rep/Prospect labels
- [ ] Transcript latency < 2s (partial transcripts)
- [ ] At least one coaching category (Say this / Ask this / Watch out) in real time
- [ ] Demo works on real OR simulated Zoom call

---

## README Outline

```markdown
# CallWhisper

Real-time AI sales coaching during Zoom calls.

## What It Does
[3 sentences on capture → transcribe → coach loop]

## Setup

### Prerequisites
- macOS
- Node.js 20+
- BlackHole-2ch: `brew install blackhole-2ch`
- Zoom app (configure audio output to BlackHole)

### Install
```
npm install
cd client && npm install
```

### Environment
Copy `.env.example` to `.env`, fill in:
- `DEEPGRAM_API_KEY`
- `ANTHROPIC_API_KEY`

### Run
```
npm run dev
```
Open http://localhost:5173, click Start.

## Architecture

[Diagram or bullet list: browser captures 2 streams → sends to Node.js → Deepgram (2 connections) → transcript buffer → Claude every 8s → coaching UI]

### Why This Stack
- BlackHole over Loopback: free, sufficient for prototype
- Deepgram over Whisper: streaming API, lower latency
- Claude over GPT-4: required by SOW, better at structured output
- Browser + Node over Electron: faster to build, no native compile step

## Known Limitations
- Requires BlackHole setup (manual step, not automated)
- No session persistence — restart clears transcript
- No WebSocket reconnection retry beyond 3 attempts
- Coaching latency depends on Claude API response time (~1-3s added)
- System audio capture relies on user correctly routing Zoom output to BlackHole
- Not tested on Windows or Linux
```

---

## Demo Video Outline (3–5 min)

**0:00–0:30 — Setup shot**
Show: terminal with `docker compose up` output on LXC 100, browser open at callwhisper.batuhanboran.com, Zoom configured with BlackHole as speaker output

**0:30–1:00 — Architecture walkthrough (30s)**
Say: "Browser captures mic and Zoom audio separately via BlackHole → WebSocket to Node backend → two Deepgram Nova-2 streams → Claude every 8 seconds → coaching in the UI"

**1:00–1:30 — Start session**
Click Start button, select mic device and BlackHole device from dropdowns
Point out: header shows two stream indicators (Rep dot + Prospect dot) go green with live level bars

**1:30–3:00 — Live demo**
Join Zoom call (or play simulated audio from second device)
Show:
- Transcript appearing with [Rep] / [Prospect] labels in real time
- Partial transcripts appearing < 2s (point this out verbally: "already transcribing")
- Talk ratio bar updating as conversation progresses

**3:00–4:00 — Coaching appearing**
Show right coaching panel:
- First card appears after ~8s of conversation
- Show `say_this`, `ask_this`, `watch_out` fields
- Point out `call_stage` badge (e.g. "discovery") and `objection_type` badge
- Say a price objection ("that's a bit expensive") → watch_out triggers within 3s (fast path)
- Show coaching history — last 5 cards stacked newest on top

**4:00–4:30 — Disconnect test**
Temporarily disable network → stream indicators go yellow (reconnecting) → re-enable → back to green automatically
Point out: "No manual restart needed — unlimited retries with backoff"

**4:30–5:00 — Stop + close**
Click Stop, show all streams close cleanly
Mention: backend runs 24/7 on LXC 100 Docker, accessible at callwhisper.batuhanboran.com

---

## Known Limitations Section (for README)

Use this exact text — honest, shows you know the tradeoffs:

```
## Known Limitations

- **BlackHole dependency**: System audio capture requires manual BlackHole setup and 
  Zoom audio routing. This step is not automated. First-time setup takes ~5 minutes.
  
- **No session persistence**: Transcripts and coaching history live in memory only. 
  Restarting the server clears all state.

- **Coaching latency**: Claude API adds 1–3 seconds on top of transcription. 
  Total end-to-end coaching latency is ~4–5 seconds from speech to suggestion.
  
- **No diarization within stream**: Speaker identification is by audio source (stream 1 = Rep, 
  stream 2 = Prospect), not by voice. Cross-talk within one stream is not separated.

- **No reconnection persistence**: If a Deepgram WebSocket drops, it reconnects but 
  transcript history is not replayed.

- **macOS only**: Not tested on Windows or Linux.
```

---

## Private Repo Checklist

- [x] `.env` in `.gitignore`
- [x] `.env.example` committed with placeholder values
- [x] No API keys hardcoded anywhere
- [x] README.md at root
- [x] All source committed (no `node_modules`)
- [x] Repo set to Private
- [ ] @serhatoptimum7 added as collaborator (manual: GitHub Settings → Collaborators)
