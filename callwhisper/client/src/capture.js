const BACKEND_WS = import.meta.env.VITE_BACKEND_WS || '';
const SAMPLE_RATE = 16000;
const RECONNECT_MAX_DELAY = 10000;

function float32ToInt16(float32Array) {
  const int16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

async function createAudioSender(stream, wsPath, { onStatus, onLevel } = {}) {
  const wsUrl = BACKEND_WS ? `${BACKEND_WS}${wsPath}` : wsPath;
  let ws = null;
  let stopped = false;
  let reconnectAttempts = 0;
  let reconnectTimer = null;

  const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
  const source = audioCtx.createMediaStreamSource(stream);
  const processor = audioCtx.createScriptProcessor(4096, 1, 1);

  // Level monitoring
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  const levelBuf = new Uint8Array(analyser.frequencyBinCount);
  const levelInterval = setInterval(() => {
    analyser.getByteFrequencyData(levelBuf);
    const avg = levelBuf.reduce((a, b) => a + b, 0) / levelBuf.length;
    onLevel?.(Math.min(100, Math.round(avg * 2)));
  }, 200);

  function connect() {
    if (stopped) return;
    ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      reconnectAttempts = 0;
      console.log(`[Capture] WS open: ${wsPath}`);
      onStatus?.('connected');
    };

    ws.onerror = () => onStatus?.('error');

    ws.onclose = () => {
      console.log(`[Capture] WS closed: ${wsPath}`);
      if (stopped) {
        clearInterval(levelInterval);
        return;
      }
      const delay = Math.min(RECONNECT_MAX_DELAY, 500 * Math.pow(2, reconnectAttempts));
      reconnectAttempts++;
      onStatus?.('reconnecting');
      reconnectTimer = setTimeout(connect, delay);
    };
  }

  connect();

  processor.onaudioprocess = (e) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(float32ToInt16(e.inputBuffer.getChannelData(0)).buffer);
  };

  source.connect(processor);
  processor.connect(audioCtx.destination);

  return {
    stop() {
      stopped = true;
      clearTimeout(reconnectTimer);
      clearInterval(levelInterval);
      processor.disconnect();
      source.disconnect();
      analyser.disconnect();
      audioCtx.close();
      ws?.close();
      onStatus?.('stopped');
    },
  };
}

export async function startCapture(micDeviceId, systemDeviceId, callbacks = {}) {
  const constraints = (deviceId) => ({
    audio: {
      deviceId: { exact: deviceId },
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      sampleRate: SAMPLE_RATE,
      channelCount: 1,
    },
    video: false,
  });

  let micStream, sysStream;

  micStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: { exact: micDeviceId },
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: SAMPLE_RATE,
      channelCount: 1,
    },
    video: false,
  });

  if (systemDeviceId === '__display__') {
    // Use tab/screen audio capture — no VB-Cable needed
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: { width: 1, height: 1 },
    });
    const audioTracks = displayStream.getAudioTracks();
    if (!audioTracks.length) throw new Error('No audio track from screen share — make sure to check "Share tab audio"');
    // Stop video track immediately (we only need audio)
    displayStream.getVideoTracks().forEach(t => t.stop());
    sysStream = new MediaStream(audioTracks);
  } else {
    sysStream = await navigator.mediaDevices.getUserMedia(constraints(systemDeviceId));
  }

  const [repSender, prospectSender] = await Promise.all([
    createAudioSender(micStream, '/audio-rep', {
      onStatus: (s) => callbacks.onRepStatus?.(s),
      onLevel:  (v) => callbacks.onRepLevel?.(v),
    }),
    createAudioSender(sysStream, '/audio-prospect', {
      onStatus: (s) => callbacks.onProspectStatus?.(s),
      onLevel:  (v) => callbacks.onProspectLevel?.(v),
    }),
  ]);

  return {
    stop() {
      repSender.stop();
      prospectSender.stop();
      micStream.getTracks().forEach((t) => t.stop());
      sysStream.getTracks().forEach((t) => t.stop());
    },
  };
}

export async function listAudioInputs() {
  await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'audioinput');
}
