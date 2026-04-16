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
    wssRep.handleUpgrade(request, socket, head, (ws) => wssRep.emit('connection', ws));
  } else if (pathname === '/audio-prospect') {
    wssProspect.handleUpgrade(request, socket, head, (ws) => wssProspect.emit('connection', ws));
  } else if (pathname === '/events') {
    wssEvents.handleUpgrade(request, socket, head, (ws) => wssEvents.emit('connection', ws));
  } else {
    socket.destroy();
  }
});

wssRep.on('connection', (ws) => {
  console.log('[Server] Rep connected');
  deepgramRep.connect();
  ws.on('message', (data) => deepgramRep.send(data));
  ws.on('close', () => {
    console.log('[Server] Rep disconnected');
    deepgramRep.disconnect();
  });
  ws.on('error', (err) => console.error('[Server] Rep WS error:', err.message));
});

wssProspect.on('connection', (ws) => {
  console.log('[Server] Prospect connected');
  deepgramProspect.connect();
  ws.on('message', (data) => deepgramProspect.send(data));
  ws.on('close', () => {
    console.log('[Server] Prospect disconnected');
    deepgramProspect.disconnect();
  });
  ws.on('error', (err) => console.error('[Server] Prospect WS error:', err.message));
});

wssEvents.on('connection', (ws) => {
  console.log('[Server] Events client connected');

  const txHistory = transcript.getAll();
  if (txHistory.length) {
    ws.send(JSON.stringify({ type: 'transcript_history', data: txHistory }));
  }

  const coachHistory = coaching.getHistory();
  if (coachHistory.length) {
    ws.send(JSON.stringify({ type: 'coaching_history', data: coachHistory }));
  }

  ws.send(JSON.stringify({ type: 'stats', data: transcript.getTalkStats() }));

  ws.on('close', () => console.log('[Server] Events client disconnected'));
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
