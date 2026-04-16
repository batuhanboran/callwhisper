const BACKEND_WS = import.meta.env.VITE_BACKEND_WS || '';
const SAMPLE_RATE = 16000;

// Convert Float32 PCM to Int16 PCM (Deepgram linear16 format)
function float32ToInt16(float32Array) {
  const int16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

async function createAudioSender(stream, wsPath) {
  const wsUrl = BACKEND_WS ? `${BACKEND_WS}${wsPath}` : wsPath;
  const ws = new WebSocket(wsUrl);
  ws.binaryType = 'arraybuffer';

  const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
  const source = audioCtx.createMediaStreamSource(stream);

  // ScriptProcessor: widely supported, sufficient for prototype
  const processor = audioCtx.createScriptProcessor(4096, 1, 1);

  processor.onaudioprocess = (e) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    const float32 = e.inputBuffer.getChannelData(0);
    const int16 = float32ToInt16(float32);
    ws.send(int16.buffer);
  };

  source.connect(processor);
  processor.connect(audioCtx.destination);

  ws.onopen = () => console.log(`[Capture] WS open: ${wsPath}`);
  ws.onerror = (e) => console.error(`[Capture] WS error: ${wsPath}`, e);
  ws.onclose = () => console.log(`[Capture] WS closed: ${wsPath}`);

  return {
    stop() {
      processor.disconnect();
      source.disconnect();
      audioCtx.close();
      ws.close();
    },
  };
}

export async function startCapture(micDeviceId, systemDeviceId) {
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

  const [micStream, sysStream] = await Promise.all([
    navigator.mediaDevices.getUserMedia(constraints(micDeviceId)),
    navigator.mediaDevices.getUserMedia(constraints(systemDeviceId)),
  ]);

  const [repSender, prospectSender] = await Promise.all([
    createAudioSender(micStream, '/audio-rep'),
    createAudioSender(sysStream, '/audio-prospect'),
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
