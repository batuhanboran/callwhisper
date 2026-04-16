import React, { useState, useEffect, useRef, useCallback } from 'react';
import { startCapture, listAudioInputs } from './capture';

const BACKEND_WS = import.meta.env.VITE_BACKEND_WS || '';

const OBJECTION_COLORS = {
  price: '#ef9a9a',
  timing: '#ffcc80',
  authority: '#ce93d8',
  competitor: '#80cbc4',
  feature: '#90caf9',
};

const STAGE_COLORS = {
  opening: '#555',
  discovery: '#1565c0',
  demo: '#1b5e20',
  objection: '#b71c1c',
  closing: '#f57f17',
};

const styles = {
  app: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f0f0f', color: '#e0e0e0', fontFamily: 'monospace' },
  header: { padding: '10px 20px', background: '#1a1a1a', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  title: { fontSize: '16px', fontWeight: 'bold', color: '#fff' },
  status: { fontSize: '11px', padding: '3px 8px', borderRadius: '4px' },
  timer: { fontSize: '12px', color: '#888', minWidth: '52px' },
  talkRatio: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' },
  ratioBar: { width: '80px', height: '6px', background: '#333', borderRadius: '3px', overflow: 'hidden' },
  ratioFill: { height: '100%', background: '#4fc3f7', borderRadius: '3px', transition: 'width 0.5s' },
  panels: { display: 'flex', flex: 1, overflow: 'hidden' },
  panel: { flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #333' },
  panelHeader: { padding: '8px 16px', background: '#1a1a1a', fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  panelContent: { flex: 1, overflowY: 'auto', padding: '12px 16px' },
  transcriptLine: { marginBottom: '8px', lineHeight: '1.5', fontSize: '13px' },
  speaker: { fontWeight: 'bold', marginRight: '6px' },
  rep: { color: '#4fc3f7' },
  prospect: { color: '#a5d6a7' },
  interim: { opacity: 0.45, fontStyle: 'italic' },
  timestamp: { color: '#555', fontSize: '11px', marginRight: '6px' },
  coachingEntry: { marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #222' },
  coachingEntryOld: { opacity: 0.45 },
  coachingBlock: { marginBottom: '8px', padding: '10px 12px', background: '#1a1a1a', borderRadius: '5px', borderLeft: '3px solid #555' },
  coachLabel: { fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px', color: '#888' },
  coachText: { fontSize: '13px', lineHeight: '1.4' },
  sayThis: { borderLeftColor: '#4fc3f7' },
  askThis: { borderLeftColor: '#a5d6a7' },
  watchOut: { borderLeftColor: '#ffb74d' },
  badge: { display: 'inline-block', padding: '2px 7px', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold', marginRight: '6px' },
  coachMeta: { color: '#444', fontSize: '10px', marginTop: '4px', display: 'flex', gap: '8px', alignItems: 'center' },
  btn: { padding: '7px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' },
  btnStart: { background: '#4caf50', color: '#fff' },
  btnStop: { background: '#f44336', color: '#fff' },
  select: { background: '#1a1a1a', color: '#e0e0e0', border: '1px solid #444', padding: '4px 6px', borderRadius: '4px', fontSize: '11px', maxWidth: '200px' },
  empty: { color: '#444', fontSize: '13px', marginTop: '20px', textAlign: 'center' },
};

function fmt(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtTimer(s) {
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${m}:${sec}`;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [running, setRunning] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [coachingHistory, setCoachingHistory] = useState([]);
  const [talkStats, setTalkStats] = useState({ rep: { words: 0 }, prospect: { words: 0 } });
  const [devices, setDevices] = useState([]);
  const [micId, setMicId] = useState('');
  const [sysId, setSysId] = useState('');
  const [statusMsg, setStatusMsg] = useState('Ready');
  const [sessionSecs, setSessionSecs] = useState(0);
  const transcriptEndRef = useRef(null);
  const wsRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    listAudioInputs()
      .then((devs) => {
        setDevices(devs);
        if (devs.length > 0) setMicId(devs[0].deviceId);
        const bh = devs.find((d) => d.label.toLowerCase().includes('blackhole'));
        if (bh) setSysId(bh.deviceId);
        else if (devs.length > 1) setSysId(devs[1].deviceId);
      })
      .catch((e) => setStatusMsg('Mic permission denied: ' + e.message));
  }, []);

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript]);

  useEffect(() => {
    if (running) {
      setSessionSecs(0);
      timerRef.current = setInterval(() => setSessionSecs((s) => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [running]);

  const connectEvents = useCallback(() => {
    const wsUrl = BACKEND_WS ? `${BACKEND_WS}/events` : `ws://${window.location.host}/events`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'transcript') {
        setTranscript((prev) => {
          if (!msg.data.is_final) {
            const last = prev[prev.length - 1];
            if (last && !last.is_final && last.speaker === msg.data.speaker) {
              return [...prev.slice(0, -1), msg.data];
            }
          }
          return [...prev, msg.data];
        });
      } else if (msg.type === 'transcript_history') {
        setTranscript(msg.data);
      } else if (msg.type === 'coaching') {
        setCoachingHistory((prev) => [msg.data, ...prev].slice(0, 5));
      } else if (msg.type === 'coaching_history') {
        setCoachingHistory(msg.data);
      } else if (msg.type === 'stats') {
        setTalkStats(msg.data);
      }
    };

    ws.onopen = () => setStatusMsg('Connected');
    ws.onerror = () => setStatusMsg('Connection error');
    ws.onclose = () => {
      setStatusMsg('Disconnected');
      if (running) setTimeout(connectEvents, 2000);
    };
  }, [running]);

  const handleStart = async () => {
    if (!micId || !sysId) {
      setStatusMsg('Select both mic and system audio devices');
      return;
    }
    try {
      setStatusMsg('Starting...');
      connectEvents();
      const cap = await startCapture(micId, sysId);
      setSession(cap);
      setRunning(true);
      setStatusMsg('Live');
    } catch (e) {
      setStatusMsg('Failed: ' + e.message);
    }
  };

  const handleStop = () => {
    if (session) session.stop();
    if (wsRef.current) wsRef.current.close();
    setSession(null);
    setRunning(false);
    setStatusMsg('Stopped');
  };

  const totalWords = (talkStats.rep.words || 0) + (talkStats.prospect.words || 0);
  const repPct = totalWords > 0 ? Math.round((talkStats.rep.words / totalWords) * 100) : 50;

  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <span style={styles.title}>CallWhisper</span>
        <span style={{ ...styles.status, background: running ? '#1b5e20' : '#333', color: running ? '#a5d6a7' : '#888' }}>
          {statusMsg}
        </span>
        {running && <span style={styles.timer}>{fmtTimer(sessionSecs)}</span>}
        {totalWords > 0 && (
          <div style={styles.talkRatio}>
            <span style={{ color: '#4fc3f7', fontSize: '10px' }}>Rep {repPct}%</span>
            <div style={styles.ratioBar}>
              <div style={{ ...styles.ratioFill, width: `${repPct}%` }} />
            </div>
            <span style={{ color: '#a5d6a7', fontSize: '10px' }}>{100 - repPct}% Prospect</span>
          </div>
        )}
        <select style={styles.select} value={micId} onChange={(e) => setMicId(e.target.value)} disabled={running}>
          <option value="">— Rep mic —</option>
          {devices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId.slice(0, 20)}</option>)}
        </select>
        <select style={styles.select} value={sysId} onChange={(e) => setSysId(e.target.value)} disabled={running}>
          <option value="">— Prospect / System audio —</option>
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
            {transcript.map((entry, i) => (
              <div key={i} style={{ ...styles.transcriptLine, ...(entry.is_final ? {} : styles.interim) }}>
                <span style={styles.timestamp}>{fmt(entry.timestamp)}</span>
                <span style={{ ...styles.speaker, ...(entry.speaker === 'Rep' ? styles.rep : styles.prospect) }}>
                  [{entry.speaker}]
                </span>
                {entry.text}
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* Right: Coaching */}
        <div style={{ ...styles.panel, borderRight: 'none' }}>
          <div style={styles.panelHeader}>
            <span>AI Coaching</span>
            {coachingHistory.length > 0 && <span style={{ fontSize: '10px' }}>{coachingHistory.length} update{coachingHistory.length > 1 ? 's' : ''}</span>}
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
                      {entry.objection_type} objection
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
