class TranscriptManager {
  constructor() {
    this.entries = [];
    this.windowSeconds = parseInt(process.env.TRANSCRIPT_WINDOW_S) || 90;
    this.lastAddedAt = 0;
  }

  add(entry) {
    this.entries.push(entry);
    this.lastAddedAt = Date.now();
    // Cap at 300 entries
    if (this.entries.length > 300) this.entries.shift();
  }

  // Returns formatted string of last N seconds for Claude
  getWindow() {
    const cutoff = Date.now() - this.windowSeconds * 1000;
    const recent = this.entries.filter(
      (e) => new Date(e.timestamp).getTime() > cutoff && e.is_final
    );
    return recent.map((e) => `[${e.speaker}]: ${e.text}`).join('\n');
  }

  // Returns all final entries (for history on reconnect)
  getAll() {
    return this.entries.filter((e) => e.is_final);
  }

  // Has new content since given timestamp?
  hasNewSince(tsMs) {
    return this.lastAddedAt > tsMs;
  }
}

module.exports = TranscriptManager;
