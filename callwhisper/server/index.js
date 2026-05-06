require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const cors = require('cors');
const DeepgramManager = require('./deepgram');
const TranscriptManager = require('./transcript');
const CoachingEngine = require('./coach');

const app = express();
app.use(cors());
const server = http.createServer(app);

app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

const ALLOWED_MODELS = new Set([
  'gemini-2.5-flash', 'gemini-2.5-flash-lite',
  'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.0-flash-001',
  'gemini-flash-latest', 'gemini-flash-lite-latest',
  'gemini-3-flash-preview', 'gemini-3.1-flash-lite-preview',
  'claude-haiku-4-5-20251001', 'claude-3-5-haiku-20241022',
  'claude-sonnet-4-6',
]);

const ALLOWED_TRANSCRIPT_LANGUAGES = new Set(['multi', 'en-US', 'tr']);

function getDefaultTranscriptLanguage() {
  return ALLOWED_TRANSCRIPT_LANGUAGES.has(process.env.TRANSCRIPT_LANGUAGE)
    ? process.env.TRANSCRIPT_LANGUAGE
    : 'multi';
}

function getTranscriptConfig(request) {
  const { searchParams } = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const requestedLanguage = searchParams.get('language');

  if (requestedLanguage && !ALLOWED_TRANSCRIPT_LANGUAGES.has(requestedLanguage)) {
    console.warn(`[Server] Ignoring unsupported transcript language: ${requestedLanguage}`);
  }

  return {
    language: ALLOWED_TRANSCRIPT_LANGUAGES.has(requestedLanguage)
      ? requestedLanguage
      : getDefaultTranscriptLanguage(),
  };
}

const wssRep      = new WebSocketServer({ noServer: true });
const wssProspect = new WebSocketServer({ noServer: true });
const wssEvents   = new WebSocketServer({ noServer: true });

const transcript = new TranscriptManager();
const coaching   = new CoachingEngine(transcript);

const deepgramRep      = new DeepgramManager('Rep',      transcript, wssEvents);
const deepgramProspect = new DeepgramManager('Prospect', transcript, wssEvents);

server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url, `http://${request.headers.host}`);
  if (pathname === '/audio-rep') {
    wssRep.handleUpgrade(request, socket, head, (ws) => wssRep.emit('connection', ws, request));
  } else if (pathname === '/audio-prospect') {
    wssProspect.handleUpgrade(request, socket, head, (ws) => wssProspect.emit('connection', ws, request));
  } else if (pathname === '/events') {
    wssEvents.handleUpgrade(request, socket, head, (ws) => wssEvents.emit('connection', ws, request));
  } else {
    socket.destroy();
  }
});

wssRep.on('connection', (ws, request) => {
  const transcriptConfig = getTranscriptConfig(request);
  console.log(`[Server] Rep connected (${transcriptConfig.language})`);
  deepgramRep.connect(transcriptConfig);
  ws.on('message', (data) => deepgramRep.send(data));
  ws.on('close', () => {
    console.log('[Server] Rep disconnected');
    deepgramRep.disconnect();
  });
  ws.on('error', (err) => console.error('[Server] Rep WS error:', err.message));
});

wssProspect.on('connection', (ws, request) => {
  const transcriptConfig = getTranscriptConfig(request);
  console.log(`[Server] Prospect connected (${transcriptConfig.language})`);
  deepgramProspect.connect(transcriptConfig);
  ws.on('message', (data) => deepgramProspect.send(data));
  ws.on('close', () => {
    console.log('[Server] Prospect disconnected');
    deepgramProspect.disconnect();
  });
  ws.on('error', (err) => console.error('[Server] Prospect WS error:', err.message));
});

wssEvents.on('connection', (ws, request) => {
  console.log('[Server] Events client connected');
  const { searchParams } = new URL(request.url, `http://${request.headers.host}`);

  if (searchParams.get('reset') === '1') {
    transcript.clear();
    coaching.resetHistory();
    ws.send(JSON.stringify({ type: 'session_reset' }));
    console.log('[Server] Session state reset');
  }

  const txHistory = transcript.getAll();
  if (txHistory.length) {
    ws.send(JSON.stringify({ type: 'transcript_history', data: txHistory }));
  }

  const coachHistory = coaching.getHistory();
  if (coachHistory.length) {
    ws.send(JSON.stringify({ type: 'coaching_history', data: coachHistory }));
  }

  ws.send(JSON.stringify({ type: 'stats', data: transcript.getTalkStats() }));

  // Ping every 30s to keep connection alive through proxies
  const pingTimer = setInterval(() => {
    if (ws.readyState === 1) ws.ping();
  }, 30000);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString().slice(0, 2048));
      if (msg.type === 'set_model' && ALLOWED_MODELS.has(msg.model)) {
        coaching.setModel(msg.model);
      } else if (msg.type === 'set_config') {
        if (msg.deepgramKey) {
          deepgramRep.updateKey(msg.deepgramKey);
          deepgramProspect.updateKey(msg.deepgramKey);
        }
        if (msg.geminiKey || msg.anthropicKey) {
          coaching.updateKeys({ geminiKey: msg.geminiKey, anthropicKey: msg.anthropicKey });
        }
      }
    } catch (_) {}
  });

  ws.on('close', () => {
    clearInterval(pingTimer);
    console.log('[Server] Events client disconnected');
  });
  ws.on('error', (err) => console.error('[Server] Events WS error:', err.message));
});

// Broadcast talk stats every 10s
setInterval(() => {
  const json = JSON.stringify({ type: 'stats', data: transcript.getTalkStats() });
  wssEvents.clients.forEach((c) => { if (c.readyState === 1) c.send(json); });
}, 10000);

coaching.start(wssEvents);

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] CallWhisper running on :${PORT}`);
});
