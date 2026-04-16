const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');

class DeepgramManager {
  constructor(speaker, transcript, wssEvents) {
    this.speaker = speaker; // 'Rep' or 'Prospect'
    this.transcript = transcript;
    this.wssEvents = wssEvents;
    this.client = createClient(process.env.DEEPGRAM_API_KEY);
    this.connection = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnects = 3;
    this.pendingAudio = [];
    this.active = false;
  }

  connect() {
    if (this.isConnected) return;
    this.active = true;
    this._open();
  }

  _open() {
    console.log(`[Deepgram] Opening ${this.speaker} stream...`);

    this.connection = this.client.listen.live({
      model: 'nova-2',
      language: 'en-US',
      smart_format: true,
      encoding: 'linear16',
      channels: 1,
      sample_rate: 16000,
      interim_results: true,
      utterance_end_ms: 1000,
      vad_events: true,
    });

    this.connection.on(LiveTranscriptionEvents.Open, () => {
      console.log(`[Deepgram] ${this.speaker} stream open`);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      // Flush buffered audio
      this.pendingAudio.forEach((chunk) => this.connection.send(chunk));
      this.pendingAudio = [];
    });

    this.connection.on(LiveTranscriptionEvents.Transcript, (data) => {
      const alt = data.channel?.alternatives?.[0];
      if (!alt?.transcript?.trim()) return;

      const entry = {
        speaker: this.speaker,
        text: alt.transcript.trim(),
        timestamp: new Date().toISOString(),
        is_final: data.is_final === true,
      };

      if (entry.is_final) {
        this.transcript.add(entry);
        console.log(`[${this.speaker}] ${entry.text}`);
      }

      this._broadcast({ type: 'transcript', data: entry });
    });

    this.connection.on(LiveTranscriptionEvents.Error, (err) => {
      console.error(`[Deepgram] ${this.speaker} error:`, err.message || err);
    });

    this.connection.on(LiveTranscriptionEvents.Close, () => {
      console.log(`[Deepgram] ${this.speaker} stream closed`);
      this.isConnected = false;
      if (this.active && this.reconnectAttempts < this.maxReconnects) {
        this.reconnectAttempts++;
        const delay = this.reconnectAttempts * 1500;
        console.log(`[Deepgram] ${this.speaker} reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
        setTimeout(() => this._open(), delay);
      }
    });
  }

  send(audioChunk) {
    if (this.isConnected && this.connection) {
      this.connection.send(audioChunk);
    } else {
      if (this.pendingAudio.length < 20) this.pendingAudio.push(audioChunk);
    }
  }

  disconnect() {
    this.active = false;
    this.isConnected = false;
    this.reconnectAttempts = this.maxReconnects;
    if (this.connection) {
      try { this.connection.finish(); } catch (_) {}
      this.connection = null;
    }
    this.pendingAudio = [];
    console.log(`[Deepgram] ${this.speaker} disconnected`);
  }

  _broadcast(message) {
    const json = JSON.stringify(message);
    this.wssEvents.clients.forEach((client) => {
      if (client.readyState === 1) client.send(json);
    });
  }
}

module.exports = DeepgramManager;
