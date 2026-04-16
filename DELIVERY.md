# CallWhisper — Delivery Checklist & Assets

## Submission Checklist

### Required Deliverables
- [x] Private GitHub repo created — https://github.com/batuhanboran/callwhisper
- [ ] Repo shared with @serhatoptimum7 — add via GitHub Settings → Collaborators
- [x] README.md with setup instructions
- [x] README.md with architecture decisions
- [x] README.md with known limitations
- [ ] 3–5 min demo video showing tool working on test call
- [x] AI session logs (SESSION_LOG.md — Sessions 1 + 2 complete)

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
Show: terminal with server running, browser open, BlackHole configured in Zoom settings

**0:30–1:00 — Architecture walkthrough (30s)**
Say the architecture explanation from PLAN.md while showing the code structure

**1:00–1:30 — Start session**
Click Start button, show both audio devices being selected

**1:30–3:00 — Live demo**
Join Zoom call (or play simulated audio)
Show:
- Transcript appearing with [Rep] / [Prospect] labels in real time
- Timestamps on each line
- Partial transcripts < 2s (point this out verbally)

**3:00–4:00 — Coaching appearing**
Show right panel:
- "Say this: ..."
- "Ask this: ..."
- "Watch out: ..." (trigger a price or competitor mention)
Point out suggestions are contextually relevant to the conversation

**4:00–4:30 — Stop session**
Click Stop, show clean shutdown

**4:30–5:00 — Close**
Briefly mention known limitations and what would come next (objection classification, RAG, etc.)

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
