const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');

const KEEPALIVE_INTERVAL = 8000;  // ms — prevent Deepgram idle timeout
const RECONNECT_MAX_DELAY = 30000;
const ALLOWED_TRANSCRIPT_LANGUAGES = new Set(['multi', 'en-US', 'tr']);
const DEFAULT_DEEPGRAM_MODEL = process.env.DEEPGRAM_MODEL || 'nova-3';

function getDefaultTranscriptLanguage() {
  return ALLOWED_TRANSCRIPT_LANGUAGES.has(process.env.TRANSCRIPT_LANGUAGE)
    ? process.env.TRANSCRIPT_LANGUAGE
    : 'multi';
}

function getEndpointingMs() {
  const value = parseInt(process.env.DEEPGRAM_ENDPOINTING_MS, 10);
  return Number.isFinite(value) && value > 0 ? value : 100;
}

class DeepgramManager {
  constructor(speaker, transcript, wssEvents) {
    this.speaker = speaker;
    this.transcript = transcript;
    this.wssEvents = wssEvents;
    this.apiKey = process.env.DEEPGRAM_API_KEY || '';
    this.client = this.apiKey ? createClient(this.apiKey) : null;
    this.connection = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.pendingAudio = [];
    this.active = false;
    this.keepAliveTimer = null;
    this.reconnectTimer = null;
    this.streamConfig = {
      model: DEFAULT_DEEPGRAM_MODEL,
      language: getDefaultTranscriptLanguage(),
    };
  }

  updateKey(key) {
    if (!key) return;
    this.apiKey = key;
    this.client = createClient(key);
    console.log(`[Deepgram] ${this.speaker} key updated`);
    if (this.active && !this.isConnected) this._open();
  }

  connect(config = {}) {
    this.streamConfig = {
      model: config.model || process.env.DEEPGRAM_MODEL || DEFAULT_DEEPGRAM_MODEL,
      language: ALLOWED_TRANSCRIPT_LANGUAGES.has(config.language)
        ? config.language
        : getDefaultTranscriptLanguage(),
    };
    if (this.isConnected) return;
    this.active = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this._open();
  }

  _open() {
    if (!this.active) return;
    if (!this.client) {
      console.warn(`[Deepgram] ${this.speaker} stream waiting for API key`);
      this._broadcastStatus('waiting_for_key');
      return;
    }
    const liveOptions = {
      model: this.streamConfig.model,
      language: this.streamConfig.language,
      smart_format: true,
      encoding: 'linear16',
      channels: 1,
      sample_rate: 16000,
      interim_results: true,
      utterance_end_ms: 1000,
      vad_events: true,
    };

    if (this.streamConfig.language === 'multi') {
      liveOptions.endpointing = getEndpointingMs();
    }

    console.log(
      `[Deepgram] Opening ${this.speaker} stream (${liveOptions.model}/${liveOptions.language}, attempt ${this.reconnectAttempts + 1})...`
    );

    this.connection = this.client.listen.live(liveOptions);

    this.connection.on(LiveTranscriptionEvents.Open, () => {
      console.log(`[Deepgram] ${this.speaker} connected`);
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Flush buffered audio
      this.pendingAudio.forEach((chunk) => this.connection.send(chunk));
      this.pendingAudio = [];

      // Keepalive — prevents Deepgram from closing idle connection
      this._startKeepalive();

      this._broadcastStatus('connected');
    });

    this.connection.on(LiveTranscriptionEvents.Transcript, (data) => {
      const alt = data.channel?.alternatives?.[0];
      if (!alt?.transcript?.trim()) return;

      const entry = {
        speaker: this.speaker,
        text: alt.transcript.trim(),
        timestamp: new Date().toISOString(),
        is_final: data.is_final === true,
        confidence: alt.confidence ?? null,
        languages: alt.languages || null,
      };

      if (entry.is_final) {
        this.transcript.add(entry);
        console.log(`[${this.speaker}] ${entry.text}`);
      }

      this._broadcast({ type: 'transcript', data: entry });
    });

    this.connection.on(LiveTranscriptionEvents.Error, (err) => {
      console.error(`[Deepgram] ${this.speaker} error:`, err.message || JSON.stringify(err));
      this._broadcastStatus('error');
    });

    this.connection.on(LiveTranscriptionEvents.Warning, (warning) => {
      console.warn(`[Deepgram] ${this.speaker} warning:`, warning?.warn_msg || JSON.stringify(warning));
    });

    this.connection.on(LiveTranscriptionEvents.Close, () => {
      console.log(`[Deepgram] ${this.speaker} stream closed`);
      this.isConnected = false;
      this._stopKeepalive();

      if (this.active) {
        // Unlimited retries with exponential backoff, capped at 30s
        const delay = Math.min(RECONNECT_MAX_DELAY, 1500 * Math.pow(1.5, this.reconnectAttempts));
        this.reconnectAttempts++;
        console.log(`[Deepgram] ${this.speaker} reconnect in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`);
        this._broadcastStatus('reconnecting');
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          if (this.active) this._open();
        }, delay);
      }
    });
  }

  _startKeepalive() {
    this._stopKeepalive();
    this.keepAliveTimer = setInterval(() => {
      if (this.isConnected && this.connection) {
        try { this.connection.keepAlive(); } catch (_) {}
      }
    }, KEEPALIVE_INTERVAL);
  }

  _stopKeepalive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  send(audioChunk) {
    if (this.isConnected && this.connection) {
      try {
        this.connection.send(audioChunk);
      } catch (err) {
        console.error(`[Deepgram] ${this.speaker} send error:`, err.message);
        this.isConnected = false;
      }
    } else {
      if (this.pendingAudio.length < 20) this.pendingAudio.push(audioChunk);
    }
  }

  disconnect() {
    this.active = false;
    this.isConnected = false;
    this._stopKeepalive();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connection) {
      try { this.connection.finish(); } catch (_) {}
      this.connection = null;
    }
    this.pendingAudio = [];
    console.log(`[Deepgram] ${this.speaker} disconnected`);
    this._broadcastStatus('disconnected');
  }

  _broadcastStatus(status) {
    this._broadcast({ type: 'stream_status', speaker: this.speaker, status });
  }

  _broadcast(message) {
    const json = JSON.stringify(message);
    this.wssEvents.clients.forEach((client) => {
      if (client.readyState === 1) client.send(json);
    });
  }
}

module.exports = DeepgramManager;
