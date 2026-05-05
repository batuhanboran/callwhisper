import React, { useState, useEffect, useRef, useCallback } from 'react';
import { startCapture, listAudioInputs } from './capture';

const BACKEND_WS = import.meta.env.VITE_BACKEND_WS || '';

function getWsUrl(path) {
  if (BACKEND_WS) return `${BACKEND_WS}${path}`;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}

const OBJECTION_COLORS = {
  price: '#ef9a9a', timing: '#ffcc80', authority: '#ce93d8',
  competitor: '#80cbc4', feature: '#90caf9',
};
const STAGE_COLORS = {
  opening: '#555', discovery: '#1565c0', demo: '#1b5e20',
  objection: '#b71c1c', closing: '#f57f17',
};
const STATUS_COLORS = {
  connected: '#4caf50', reconnecting: '#ff9800',
  error: '#f44336', stopped: '#555', connecting: '#888',
};

const styles = {
  app: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f0f0f', color: '#e0e0e0', fontFamily: 'monospace' },
  header: { padding: '10px 20px', background: '#1a1a1a', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  title: { fontSize: '16px', fontWeight: 'bold', color: '#fff' },
  statusBadge: { fontSize: '11px', padding: '3px 8px', borderRadius: '4px' },
  timer: { fontSize: '12px', color: '#888', minWidth: '52px' },
  streamIndicator: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px' },
  dot: { width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0 },
  levelBar: { width: '40px', height: '4px', background: '#222', borderRadius: '2px', overflow: 'hidden' },
  levelFill: { height: '100%', borderRadius: '2px', transition: 'width 0.1s, background 0.2s' },
  talkRatio: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px' },
  ratioBar: { width: '70px', height: '5px', background: '#333', borderRadius: '3px', overflow: 'hidden' },
  ratioFill: { height: '100%', background: '#4fc3f7', borderRadius: '3px', transition: 'width 0.5s' },
  panels: { display: 'flex', flex: 1, overflow: 'hidden' },
  panel: { flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #333' },
  panelHeader: { padding: '8px 16px', background: '#1a1a1a', fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  panelContent: { flex: 1, overflowY: 'auto', padding: '12px 16px' },
  transcriptLine: { marginBottom: '8px', lineHeight: '1.5', fontSize: '13px' },
  speaker: { fontWeight: 'bold', marginRight: '6px' },
  rep: { color: '#4fc3f7' },
  prospect: { color: '#a5d6a7' },
  interim: { opacity: 0.4, fontStyle: 'italic' },
  timestamp: { color: '#555', fontSize: '11px', marginRight: '6px' },
  coachingEntry: { marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #222' },
  coachingEntryOld: { opacity: 0.6 },
  coachingBlock: { marginBottom: '8px', padding: '10px 12px', background: '#1a1a1a', borderRadius: '5px', borderLeft: '3px solid #555' },
  coachLabel: { fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px', color: '#888' },
  coachText: { fontSize: '13px', lineHeight: '1.4' },
  sayThis: { borderLeftColor: '#4fc3f7' },
  askThis: { borderLeftColor: '#a5d6a7' },
  watchOut: { borderLeftColor: '#ffb74d' },
  badge: { display: 'inline-block', padding: '2px 7px', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold', marginRight: '4px' },
  coachMeta: { color: '#444', fontSize: '10px', marginTop: '4px', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' },
  btn: { padding: '7px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' },
  btnStart: { background: '#4caf50', color: '#fff' },
  btnStop: { background: '#f44336', color: '#fff' },
  select: { background: '#1a1a1a', color: '#e0e0e0', border: '1px solid #444', padding: '4px 6px', borderRadius: '4px', fontSize: '11px', maxWidth: '190px' },
  empty: { color: '#444', fontSize: '13px', marginTop: '20px', textAlign: 'center' },
};

function fmt(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function fmtTimer(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function StreamIndicator({ label, status, level, color }) {
  const dotColor = STATUS_COLORS[status] || '#555';
  const levelColor = level > 20 ? '#4caf50' : level > 5 ? '#ff9800' : '#333';
  return (
    <div style={styles.streamIndicator}>
      <div style={{ ...styles.dot, background: dotColor }} title={status} />
      <span style={{ color }}>{label}</span>
      <div style={styles.levelBar}>
        <div style={{ ...styles.levelFill, width: `${level}%`, background: levelColor }} />
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false); // stable ref for WS closures — avoids stale closure bug
  const [transcript, setTranscript] = useState([]);
  const [coachingHistory, setCoachingHistory] = useState([]);
  const [talkStats, setTalkStats] = useState({ rep: { words: 0 }, prospect: { words: 0 } });
  const [devices, setDevices] = useState([]);
  const [micId, setMicId] = useState('');
  const [sysId, setSysId] = useState('__display__');
  const [coachModel, setCoachModel] = useState('gemini-2.5-flash');
  const coachModelRef = useRef('gemini-2.5-flash');
  const [coachError, setCoachError] = useState(null);
  const [repName, setRepName] = useState('Rep (You)');
  const [prospectName, setProspectName] = useState('Prospect (Caller)');
  const [deepgramKey, setDeepgramKey] = useState(() => localStorage.getItem('cw_dg_key') || '');
  const [aiKey, setAiKey] = useState(() => localStorage.getItem('cw_ai_key') || '');
  const deepgramKeyRef = useRef(deepgramKey);
  const aiKeyRef = useRef(aiKey);
  const [statusMsg, setStatusMsg] = useState('Ready');
  const [sessionSecs, setSessionSecs] = useState(0);
  const [repStreamStatus, setRepStreamStatus] = useState('stopped');
  const [prospectStreamStatus, setProspectStreamStatus] = useState('stopped');
  const [repLevel, setRepLevel] = useState(0);
  const [prospectLevel, setProspectLevel] = useState(0);
  // Deepgram handshake status (from server stream_status events)
  const [deepgramRep, setDeepgramRep] = useState('waiting');
  const [deepgramProspect, setDeepgramProspect] = useState('waiting');
  const wsRef = useRef(null);

  useEffect(() => { coachModelRef.current = coachModel; }, [coachModel]);
  useEffect(() => { deepgramKeyRef.current = deepgramKey; }, [deepgramKey]);
  useEffect(() => { aiKeyRef.current = aiKey; }, [aiKey]);
  const timerRef = useRef(null);

  useEffect(() => {
    listAudioInputs({ requestPermission: false })
      .then((devs) => {
        setDevices(devs);
        if (devs.length > 0) setMicId(devs[0].deviceId);
        const bh = devs.find((d) => d.label.toLowerCase().includes('blackhole'));
        if (bh) setSysId(bh.deviceId);
        else if (devs.length > 1) setSysId(devs[1].deviceId);
      })
      .catch((e) => setStatusMsg('Audio devices unavailable: ' + e.message));
  }, []);

useEffect(() => {
    if (running) {
      setSessionSecs(0);
      timerRef.current = setInterval(() => setSessionSecs((s) => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [running]);

  const connectEvents = useCallback(({ resetSession = false } = {}) => {
    if (wsRef.current && wsRef.current.readyState < 2) wsRef.current.close();
    const wsUrl = getWsUrl(resetSession ? '/events?reset=1' : '/events');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'transcript') {
        setTranscript((prev) => {
          if (!msg.data.is_final) {
            const first = prev[0];
            if (first && !first.is_final && first.speaker === msg.data.speaker) {
              return [msg.data, ...prev.slice(1)];
            }
          }
          return [msg.data, ...prev].slice(0, 100);
        });
      } else if (msg.type === 'transcript_history') {
        setTranscript([...msg.data].reverse().slice(0, 100));
      } else if (msg.type === 'coaching') {
        setCoachingHistory((prev) => [msg.data, ...prev].slice(0, 5));
      } else if (msg.type === 'coaching_history') {
        setCoachingHistory(msg.data);
      } else if (msg.type === 'session_reset') {
        setTranscript([]);
        setCoachingHistory([]);
        setTalkStats({ rep: { words: 0 }, prospect: { words: 0 } });
      } else if (msg.type === 'stats') {
        setTalkStats(msg.data);
      } else if (msg.type === 'stream_status') {
        if (msg.speaker === 'Rep') setDeepgramRep(msg.status);
        else setDeepgramProspect(msg.status);
      } else if (msg.type === 'coach_error') {
        setCoachError(msg.message);
        setTimeout(() => setCoachError(null), 8000);
      } else if (msg.type === 'model_changed') {
        setCoachModel(msg.model);
        coachModelRef.current = msg.model;
      }
    };

    ws.onopen = () => {
      setStatusMsg('Connected');
      ws.send(JSON.stringify({ type: 'set_model', model: coachModelRef.current }));
      const isClaude = coachModelRef.current.startsWith('claude');
      const currentDeepgramKey = deepgramKeyRef.current;
      const currentAiKey = aiKeyRef.current;
      if (currentDeepgramKey || currentAiKey) {
        ws.send(JSON.stringify({
          type: 'set_config',
          deepgramKey: currentDeepgramKey || undefined,
          geminiKey: !isClaude && currentAiKey ? currentAiKey : undefined,
          anthropicKey: isClaude && currentAiKey ? currentAiKey : undefined,
        }));
        localStorage.setItem('cw_dg_key', currentDeepgramKey);
        localStorage.setItem('cw_ai_key', currentAiKey);
      }
    };
    ws.onerror = () => {
      if (runningRef.current) setStatusMsg('Connection error');
    };
    ws.onclose = () => {
      if (!runningRef.current) return;
      setStatusMsg('Disconnected');
      // Use ref — avoids stale closure capturing old running value
      if (runningRef.current) setTimeout(connectEvents, 2000);
    };
  }, []); // no deps — uses runningRef instead of running state

  const handleStart = async () => {
    if (running) return;
    if (!sysId) {
      setStatusMsg('Select prospect / system audio');
      return;
    }
    let selectedMicId = micId;
    try {
      setStatusMsg('Starting...');
      if (!selectedMicId) {
        const devs = await listAudioInputs({ requestPermission: true });
        setDevices(devs);
        selectedMicId = devs[0]?.deviceId || '';
        if (selectedMicId) setMicId(selectedMicId);
      }
      setDeepgramRep('connecting');
      setDeepgramProspect('connecting');
      const cap = await startCapture(selectedMicId, sysId, {
        onRepStatus:      setRepStreamStatus,
        onRepLevel:       setRepLevel,
        onProspectStatus: setProspectStreamStatus,
        onProspectLevel:  setProspectLevel,
      });
      setSession(cap);
      runningRef.current = true;
      setRunning(true);
      connectEvents({ resetSession: true });
      setStatusMsg('Live');
    } catch (e) {
      runningRef.current = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setSession(null);
      setRunning(false);
      setRepStreamStatus('stopped');
      setProspectStreamStatus('stopped');
      setDeepgramRep('waiting');
      setDeepgramProspect('waiting');
      setStatusMsg('Failed: ' + e.message);
    }
  };

  const handleStop = () => {
    runningRef.current = false;
    if (session) session.stop();
    if (wsRef.current) wsRef.current.close();
    wsRef.current = null;
    setSession(null);
    setRunning(false);
    setStatusMsg('Stopped');
    setRepStreamStatus('stopped');
    setProspectStreamStatus('stopped');
    setRepLevel(0);
    setProspectLevel(0);
    setDeepgramRep('waiting');
    setDeepgramProspect('waiting');
    setTranscript([]);
    setCoachingHistory([]);
  };

  const totalWords = (talkStats.rep.words || 0) + (talkStats.prospect.words || 0);
  const repPct = totalWords > 0 ? Math.round((talkStats.rep.words / totalWords) * 100) : 50;

  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <span style={styles.title}>CallWhisper</span>
        <span style={{ ...styles.statusBadge, background: running ? '#1b5e20' : '#333', color: running ? '#a5d6a7' : '#888' }}>
          {statusMsg}
        </span>
        {running && <span style={styles.timer}>{fmtTimer(sessionSecs)}</span>}

        {/* Audio stream handshake indicators */}
        <StreamIndicator label="Rep" status={repStreamStatus} level={repLevel} color="#4fc3f7" />
        <StreamIndicator label="Prospect" status={prospectStreamStatus} level={prospectLevel} color="#a5d6a7" />
        {!running && (
          <>
            <input style={{ ...styles.select, width: '110px' }} value={repName} onChange={e => setRepName(e.target.value)} placeholder="Rep name" title="Mic input label" />
            <input style={{ ...styles.select, width: '130px' }} value={prospectName} onChange={e => setProspectName(e.target.value)} placeholder="Prospect name" title="System audio label" />
          </>
        )}

        {/* Deepgram connection status */}
        {running && (
          <span style={{ fontSize: '10px', color: '#666' }}>
            DG-Rep: <span style={{ color: STATUS_COLORS[deepgramRep] || '#555' }}>{deepgramRep}</span>
            {' · '}
            DG-Prospect: <span style={{ color: STATUS_COLORS[deepgramProspect] || '#555' }}>{deepgramProspect}</span>
          </span>
        )}

        {totalWords > 0 && (
          <div style={styles.talkRatio}>
            <span style={{ color: '#4fc3f7' }}>{repName} {repPct}%</span>
            <div style={styles.ratioBar}>
              <div style={{ ...styles.ratioFill, width: `${repPct}%` }} />
            </div>
            <span style={{ color: '#a5d6a7' }}>{100 - repPct}%</span>
          </div>
        )}

        <input
          style={{ ...styles.select, width: '140px', fontFamily: 'monospace' }}
          type="password"
          placeholder="Deepgram API Key"
          value={deepgramKey}
          onChange={e => setDeepgramKey(e.target.value)}
          disabled={running}
          title="Deepgram API Key"
        />
        <input
          style={{ ...styles.select, width: '140px', fontFamily: 'monospace' }}
          type="password"
          placeholder="Gemini / Claude Key"
          value={aiKey}
          onChange={e => setAiKey(e.target.value)}
          disabled={running}
          title="Gemini API Key (for Gemini models) or Anthropic API Key (for Claude models)"
        />
        <select style={styles.select} value={coachModel} onChange={(e) => {
          setCoachModel(e.target.value);
          if (wsRef.current?.readyState === 1) {
            wsRef.current.send(JSON.stringify({ type: 'set_model', model: e.target.value }));
            const isClaude = e.target.value.startsWith('claude');
            if (aiKey) wsRef.current.send(JSON.stringify({
              type: 'set_config',
              geminiKey: !isClaude ? aiKey : undefined,
              anthropicKey: isClaude ? aiKey : undefined,
            }));
          }
        }}>
          <optgroup label="Gemini (free tier)">
            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
            <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</option>
            <option value="gemini-flash-lite-latest">Gemini Flash Lite Latest</option>
          </optgroup>
          <optgroup label="Claude (Anthropic key)">
            <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (fastest)</option>
            <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
            <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
          </optgroup>
        </select>
        <select style={styles.select} value={micId} onChange={(e) => setMicId(e.target.value)} disabled={running}>
          <option value="">— Rep mic —</option>
          {devices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId.slice(0, 20)}</option>)}
        </select>
        <select style={styles.select} value={sysId} onChange={(e) => setSysId(e.target.value)} disabled={running}>
          <option value="">— Prospect / System audio —</option>
          <option value="__display__">🖥 Share Tab / Screen Audio</option>
          {devices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId.slice(0, 20)}</option>)}
        </select>
        {!running
          ? <button style={{ ...styles.btn, ...styles.btnStart }} onClick={handleStart}>▶ Start Session</button>
          : <button style={{ ...styles.btn, ...styles.btnStop }} onClick={handleStop}>■ Stop Session</button>
        }
      </div>

      <div style={styles.panels}>
        {/* Left: Transcript */}
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <span>Live Transcript</span>
            <span style={{ fontSize: '10px' }}>{transcript.filter(e => e.is_final).length} lines</span>
          </div>
          <div style={styles.panelContent}>
            {transcript.length === 0 && <div style={styles.empty}>Transcript will appear here...</div>}
            {transcript.map((entry, i) => {
              const isRep = entry.speaker === 'Rep';
              return (
                <div key={i} style={{ ...styles.transcriptLine, ...(entry.is_final ? {} : styles.interim), background: isRep ? 'rgba(79,195,247,0.05)' : 'rgba(165,214,167,0.05)', borderLeft: `2px solid ${isRep ? '#4fc3f7' : '#a5d6a7'}`, paddingLeft: '8px', borderRadius: '2px' }}>
                  <span style={styles.timestamp}>{fmt(entry.timestamp)}</span>
                  <span style={{ ...styles.speaker, ...(isRep ? styles.rep : styles.prospect) }}>
                    [{isRep ? repName : prospectName}]
                  </span>
                  {entry.text}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Coaching */}
        <div style={{ ...styles.panel, borderRight: 'none' }}>
          <div style={styles.panelHeader}>
            <span>AI Coaching</span>
            {coachingHistory.length > 0 && (
              <span style={{ fontSize: '10px' }}>{coachingHistory.length} update{coachingHistory.length > 1 ? 's' : ''}</span>
            )}
          </div>
          <div style={styles.panelContent}>
            {coachingHistory.length === 0 && <div style={styles.empty}>Coaching suggestions will appear here...</div>}
            {coachingHistory.map((entry, i) => (
              <div key={i} style={{ ...styles.coachingEntry, ...(i > 0 ? styles.coachingEntryOld : {}) }}>
                {entry.watch_out && (
                  <div style={{ ...styles.coachingBlock, ...styles.watchOut }}>
                    <div style={styles.coachLabel}>⚠ Watch Out</div>
                    <div style={styles.coachText}>{entry.watch_out}</div>
                  </div>
                )}
                {entry.say_this && (
                  <div style={{ ...styles.coachingBlock, ...styles.sayThis }}>
                    <div style={styles.coachLabel}>💬 Say This</div>
                    <div style={styles.coachText}>{entry.say_this}</div>
                  </div>
                )}
                {entry.ask_this && (
                  <div style={{ ...styles.coachingBlock, ...styles.askThis }}>
                    <div style={styles.coachLabel}>❓ Ask This</div>
                    <div style={styles.coachText}>{entry.ask_this}</div>
                  </div>
                )}
                <div style={styles.coachMeta}>
                  <span>{fmt(entry.timestamp)}</span>
                  {entry.call_stage && (
                    <span style={{ ...styles.badge, background: STAGE_COLORS[entry.call_stage] || '#333', color: '#fff' }}>
                      {entry.call_stage}
                    </span>
                  )}
                  {entry.objection_type && (
                    <span style={{ ...styles.badge, background: OBJECTION_COLORS[entry.objection_type] || '#888', color: '#111' }}>
                      {entry.objection_type}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {coachError && (
        <div style={{ position: 'fixed', bottom: '12px', left: '50%', transform: 'translateX(-50%)', background: '#b71c1c', color: '#fff', padding: '8px 18px', borderRadius: '5px', fontSize: '12px', zIndex: 999, boxShadow: '0 2px 8px #0008' }}>
          ⚠ AI Coaching: {coachError}
        </div>
      )}
    </div>
  );
}
