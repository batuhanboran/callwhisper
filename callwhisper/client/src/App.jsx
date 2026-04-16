import React, { useState, useEffect, useRef, useCallback } from 'react';
import { startCapture, listAudioInputs } from './capture';

const BACKEND_WS = import.meta.env.VITE_BACKEND_WS || '';

const styles = {
  app: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f0f0f', color: '#e0e0e0', fontFamily: 'monospace' },
  header: { padding: '12px 20px', background: '#1a1a1a', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: '16px' },
  title: { fontSize: '18px', fontWeight: 'bold', color: '#fff' },
  status: { fontSize: '12px', padding: '4px 8px', borderRadius: '4px' },
  panels: { display: 'flex', flex: 1, overflow: 'hidden' },
  panel: { flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #333' },
  panelHeader: { padding: '8px 16px', background: '#1a1a1a', fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' },
  panelContent: { flex: 1, overflowY: 'auto', padding: '12px 16px' },
  transcriptLine: { marginBottom: '8px', lineHeight: '1.5', fontSize: '14px' },
  speaker: { fontWeight: 'bold', marginRight: '8px' },
  rep: { color: '#4fc3f7' },
  prospect: { color: '#a5d6a7' },
  interim: { opacity: 0.5, fontStyle: 'italic' },
  timestamp: { color: '#555', fontSize: '11px', marginRight: '8px' },
  coachingBlock: { marginBottom: '16px', padding: '12px', background: '#1a1a1a', borderRadius: '6px', borderLeft: '3px solid #555' },
  coachLabel: { fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', color: '#888' },
  coachText: { fontSize: '14px', lineHeight: '1.4' },
  sayThis: { borderLeftColor: '#4fc3f7' },
  askThis: { borderLeftColor: '#a5d6a7' },
  watchOut: { borderLeftColor: '#ffb74d' },
  btn: { padding: '8px 20px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  btnStart: { background: '#4caf50', color: '#fff' },
  btnStop: { background: '#f44336', color: '#fff' },
  select: { background: '#1a1a1a', color: '#e0e0e0', border: '1px solid #444', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', maxWidth: '220px' },
  empty: { color: '#444', fontSize: '13px', marginTop: '20px', textAlign: 'center' },
};

function fmt(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function App() {
  const [session, setSession] = useState(null); // capture session
  const [running, setRunning] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [coaching, setCoaching] = useState(null);
  const [devices, setDevices] = useState([]);
  const [micId, setMicId] = useState('');
  const [sysId, setSysId] = useState('');
  const [statusMsg, setStatusMsg] = useState('Ready');
  const transcriptEndRef = useRef(null);
  const wsRef = useRef(null);

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

  const connectEvents = useCallback(() => {
    const wsUrl = BACKEND_WS ? `${BACKEND_WS}/events` : `ws://${window.location.host}/events`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'transcript') {
        setTranscript((prev) => {
          // Replace last interim or append
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
        setCoaching(msg.data);
      }
    };

    ws.onopen = () => setStatusMsg('Connected');
    ws.onerror = () => setStatusMsg('Connection error');
    ws.onclose = () => {
      setStatusMsg('Disconnected');
      if (running) {
        setTimeout(connectEvents, 2000);
      }
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

  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <span style={styles.title}>CallWhisper</span>
        <span style={{ ...styles.status, background: running ? '#1b5e20' : '#333', color: running ? '#a5d6a7' : '#888' }}>
          {statusMsg}
        </span>
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
          <div style={styles.panelHeader}>Live Transcript</div>
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
          <div style={styles.panelHeader}>AI Coaching</div>
          <div style={styles.panelContent}>
            {!coaching && <div style={styles.empty}>Coaching suggestions will appear here...</div>}
            {coaching && (
              <>
                {coaching.watch_out && (
                  <div style={{ ...styles.coachingBlock, ...styles.watchOut }}>
                    <div style={styles.coachLabel}>⚠ Watch Out</div>
                    <div style={styles.coachText}>{coaching.watch_out}</div>
                  </div>
                )}
                {coaching.say_this && (
                  <div style={{ ...styles.coachingBlock, ...styles.sayThis }}>
                    <div style={styles.coachLabel}>💬 Say This</div>
                    <div style={styles.coachText}>{coaching.say_this}</div>
                  </div>
                )}
                {coaching.ask_this && (
                  <div style={{ ...styles.coachingBlock, ...styles.askThis }}>
                    <div style={styles.coachLabel}>❓ Ask This</div>
                    <div style={styles.coachText}>{coaching.ask_this}</div>
                  </div>
                )}
                <div style={{ color: '#444', fontSize: '11px', marginTop: '8px' }}>Updated {fmt(coaching.timestamp)}</div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
