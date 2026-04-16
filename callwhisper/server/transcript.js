class TranscriptManager {
  constructor() {
    this.entries = [];
    this.windowSeconds = parseInt(process.env.TRANSCRIPT_WINDOW_S) || 90;
    this.lastAddedAt = 0;
  }

  add(entry) {
    this.entries.push(entry);
    this.lastAddedAt = Date.now();
    if (this.entries.length > 300) this.entries.shift();
  }

  getWindow() {
    const cutoff = Date.now() - this.windowSeconds * 1000;
    const recent = this.entries.filter(
      (e) => new Date(e.timestamp).getTime() > cutoff && e.is_final
    );
    return recent.map((e) => `[${e.speaker}]: ${e.text}`).join('\n');
  }

  getAll() {
    return this.entries.filter((e) => e.is_final);
  }

  hasNewSince(tsMs) {
    return this.lastAddedAt > tsMs;
  }

  getTalkStats() {
    const finals = this.entries.filter((e) => e.is_final);
    const stats = (speaker) => {
      const items = finals.filter((e) => e.speaker === speaker);
      const words = items.reduce((n, e) => n + e.text.split(/\s+/).filter(Boolean).length, 0);
      return { entries: items.length, words };
    };
    return { rep: stats('Rep'), prospect: stats('Prospect') };
  }
}

module.exports = TranscriptManager;
