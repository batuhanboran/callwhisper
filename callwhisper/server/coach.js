const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are a real-time AI sales coaching assistant embedded in a live sales call.

The transcript is labeled [Rep] (the salesperson) and [Prospect] (the potential customer).

Analyze the conversation and return ONLY a valid JSON object — no markdown, no explanation:
{
  "say_this": "A specific phrase the rep should say RIGHT NOW, or null",
  "ask_this": "A specific follow-up question the rep should ask, or null",
  "watch_out": "A specific signal detected: competitor mention, budget concern, authority issue, stall, buying signal — or null",
  "objection_type": "price | timing | authority | competitor | feature | null",
  "call_stage": "opening | discovery | demo | objection | closing | null"
}

Rules:
- Match the conversation language in all user-facing suggestions
- If the latest actionable exchange is Turkish, write Turkish coaching
- If it is English, write English coaching
- If it is mixed, follow the user's most recent language and use natural mixed-language phrasing only when useful
- Suggestions must be specific to THIS conversation, never generic
- say_this and ask_this must sound natural when spoken aloud, under 20 words each
- watch_out must name the exact signal (e.g. "Budget concern: prospect mentioned 'tight budget'")
- objection_type: classify any objection raised by the prospect; null if no objection present
- call_stage: infer from conversation flow (opening=intro, discovery=needs, demo=pitch, objection=pushback, closing=buying signals/next steps)
- If transcript is too short or nothing actionable, return nulls
- Prioritize watch_out — flags are most critical for the rep`;

const MAX_HISTORY = 5;
const DEFAULT_MODEL = 'gemini-2.5-flash';
const FALLBACK_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
];

class CoachingEngine {
  constructor(transcript) {
    this.transcript = transcript;
    this.geminiKey = process.env.GEMINI_API_KEY;
    this.anthropicKey = process.env.ANTHROPIC_API_KEY || '';
    this.model = DEFAULT_MODEL;
    this.intervalMs = parseInt(process.env.COACHING_INTERVAL_MS) || 8000;
    this.lastCoachAt = 0;
    this.timer = null;
    this.wssEvents = null;
    this.running = false;
    this.history = [];
    this._ticking = false;
  }

  setModel(model) {
    this.model = model || DEFAULT_MODEL;
    console.log(`[Coach] Model set to: ${this.model}`);
  }

  updateKeys({ geminiKey, anthropicKey }) {
    if (geminiKey) { this.geminiKey = geminiKey; console.log('[Coach] Gemini key updated'); }
    if (anthropicKey) { this.anthropicKey = anthropicKey; console.log('[Coach] Anthropic key updated'); }
  }

  start(wssEvents) {
    this.wssEvents = wssEvents;
    this.running = true;
    this.timer = setInterval(() => this._tick(), this.intervalMs);
    console.log(`[Coach] Started, interval: ${this.intervalMs}ms`);
  }

  stop() {
    this.running = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  getHistory() { return this.history; }

  resetHistory() {
    this.history = [];
    this.lastCoachAt = 0;
  }

  _isClaude() { return this.model.startsWith('claude'); }

  async _callClaude(prompt) {
    if (!this.anthropicKey) throw new Error('Anthropic API key not set');
    const client = new Anthropic({ apiKey: this.anthropicKey });
    const msg = await client.messages.create({
      model: this.model,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });
    return msg.content[0]?.text || '';
  }

  async _callGemini(prompt) {
    if (!this.geminiKey) throw new Error('Gemini API key not set');
    const genai = new GoogleGenerativeAI(this.geminiKey);
    const geminiModel = genai.getGenerativeModel({ model: this.model, systemInstruction: SYSTEM_PROMPT });
    const result = await geminiModel.generateContent(prompt);
    return result.response.text()?.trim() || '';
  }

  async _tick() {
    if (!this.running) return;
    if (this._ticking) return;
    if (!this.transcript.hasNewSince(this.lastCoachAt)) return;

    const window = this.transcript.getWindow();
    if (!window) return;

    const lines = window.split('\n').filter(Boolean);
    if (lines.length < 2) return;

    this._ticking = true;
    this.lastCoachAt = Date.now();

    try {
      const prompt = `Live sales call transcript (last ${process.env.TRANSCRIPT_WINDOW_S || 90}s):\n\n${window}\n\nProvide coaching now.`;
      console.log(`[Coach] Calling ${this.model}...`);

      const raw = this._isClaude()
        ? await this._callClaude(prompt)
        : await this._callGemini(prompt);

      if (!raw) { console.warn('[Coach] Empty response'); return; }

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) { console.error('[Coach] No JSON in response:', raw.slice(0, 200)); return; }

      const coaching = JSON.parse(jsonMatch[0]);
      if (!coaching.say_this && !coaching.ask_this && !coaching.watch_out) {
        console.log('[Coach] All nulls — skipping broadcast');
        return;
      }

      const payload = { ...coaching, timestamp: new Date().toISOString(), model: this.model };
      this.history.unshift(payload);
      if (this.history.length > MAX_HISTORY) this.history.pop();

      console.log(`[Coach] OK (${this.model}):`, JSON.stringify(payload));
      this._broadcast({ type: 'coaching', data: payload });

      if (payload.watch_out) setTimeout(() => this._tick(), 3000);

    } catch (err) {
      const status = err?.status || err?.code;
      if (status === 429) {
        if (!this._isClaude()) {
          const idx = FALLBACK_CHAIN.indexOf(this.model);
          const next = FALLBACK_CHAIN[idx + 1];
          if (next) {
            console.warn(`[Coach] 429 on ${this.model} — falling back to ${next}`);
            this.model = next;
            this._broadcast({ type: 'coach_error', message: `Rate limited — switching to ${next}` });
            this._broadcast({ type: 'model_changed', model: next });
            setTimeout(() => this._tick(), 2000);
          } else {
            console.warn('[Coach] 429 — all models exhausted, retrying in 30s');
            this._broadcast({ type: 'coach_error', message: 'All models rate limited — retrying in 30s' });
            setTimeout(() => this._tick(), 30000);
          }
        } else {
          this._broadcast({ type: 'coach_error', message: 'Claude rate limited — retrying in 30s' });
          setTimeout(() => this._tick(), 30000);
        }
      } else if (status === 503 || status === 500) {
        console.warn(`[Coach] ${status} — retrying in 5s`);
        this._broadcast({ type: 'coach_error', message: `Service ${status} — retrying in 5s` });
        setTimeout(() => this._tick(), 5000);
      } else {
        console.error('[Coach] Error:', err.message || err);
        this._broadcast({ type: 'coach_error', message: err.message || 'Unknown error' });
      }
    } finally {
      this._ticking = false;
    }
  }

  _broadcast(message) {
    if (!this.wssEvents) return;
    const json = JSON.stringify(message);
    this.wssEvents.clients.forEach((c) => { if (c.readyState === 1) c.send(json); });
  }
}

module.exports = CoachingEngine;
