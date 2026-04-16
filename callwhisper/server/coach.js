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
- Suggestions must be specific to THIS conversation, never generic
- say_this and ask_this must sound natural when spoken aloud, under 20 words each
- watch_out must name the exact signal (e.g. "Budget concern: prospect mentioned 'tight budget'")
- objection_type: classify any objection raised by the prospect; null if no objection present
- call_stage: infer from conversation flow (opening=intro, discovery=needs, demo=pitch, objection=pushback, closing=buying signals/next steps)
- If transcript is too short or nothing actionable, return nulls
- Prioritize watch_out — flags are most critical for the rep`;

const MAX_HISTORY = 5;

class CoachingEngine {
  constructor(transcript) {
    this.transcript = transcript;
    this.client = new Anthropic();
    this.intervalMs = parseInt(process.env.COACHING_INTERVAL_MS) || 8000;
    this.lastCoachAt = 0;
    this.timer = null;
    this.wssEvents = null;
    this.running = false;
    this.history = [];
  }

  start(wssEvents) {
    this.wssEvents = wssEvents;
    this.running = true;
    this.timer = setInterval(() => this._tick(), this.intervalMs);
    console.log(`[Coach] Started, interval: ${this.intervalMs}ms`);
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getHistory() {
    return this.history;
  }

  async _tick() {
    if (!this.running) return;
    if (!this.transcript.hasNewSince(this.lastCoachAt)) return;

    const window = this.transcript.getWindow();
    if (!window) return;

    const lines = window.split('\n').filter(Boolean);
    if (lines.length < 2) return;

    this.lastCoachAt = Date.now();

    try {
      const message = await this.client.messages.create(
        {
          model: 'claude-sonnet-4-6',
          max_tokens: 400,
          system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          messages: [
            {
              role: 'user',
              content: `Live sales call transcript (last ${process.env.TRANSCRIPT_WINDOW_S || 90}s):\n\n${window}\n\nProvide coaching now.`,
            },
          ],
        },
        { headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' } }
      );

      const raw = message.content[0]?.text?.trim();
      if (!raw) return;

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[Coach] No JSON in response:', raw.slice(0, 100));
        return;
      }

      const coaching = JSON.parse(jsonMatch[0]);
      const payload = { ...coaching, timestamp: new Date().toISOString() };

      this.history.unshift(payload);
      if (this.history.length > MAX_HISTORY) this.history.pop();

      console.log('[Coach]', JSON.stringify(payload));
      this._broadcast({ type: 'coaching', data: payload });

      // Critical moment: bypass normal throttle, fire again in 3s
      if (payload.watch_out) {
        setTimeout(() => this._tick(), 3000);
      }
    } catch (err) {
      console.error('[Coach] Error:', err.message);
    }
  }

  _broadcast(message) {
    if (!this.wssEvents) return;
    const json = JSON.stringify(message);
    this.wssEvents.clients.forEach((client) => {
      if (client.readyState === 1) client.send(json);
    });
  }
}

module.exports = CoachingEngine;
