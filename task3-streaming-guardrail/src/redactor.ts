const REDACTED = "[REDACTED]";

const PATTERNS: RegExp[] = [
  /[\w.+-]+@[\w-]+\.[\w.-]+/g,
  /\b\d{3}-\d{2}-\d{4}\b/g,
  /\b\d(?:[ -]?\d){12,15}\b/g,
];

// Hold enough trailing text to catch PII split across chunks.
const HOLDBACK = 40;

interface Match {
  start: number;
  end: number;
}

function findMatches(text: string): Match[] {
  const all: Match[] = [];
  for (const pattern of PATTERNS) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text))) {
      all.push({ start: m.index, end: m.index + m[0].length });
      if (m[0].length === 0) pattern.lastIndex++;
    }
  }
  all.sort((a, b) => a.start - b.start || b.end - a.end);

  const merged: Match[] = [];
  for (const m of all) {
    const prev = merged[merged.length - 1];
    if (prev && m.start < prev.end) continue;
    merged.push(m);
  }
  return merged;
}

export class StreamRedactor {
  private buffer = "";

  push(chunk: string): string {
    this.buffer += chunk;
    return this.drain(false);
  }

  flush(): string {
    return this.drain(true);
  }

  private drain(final: boolean): string {
    if (!final && this.buffer.length <= HOLDBACK) return "";

    const safeEnd = final ? this.buffer.length : this.buffer.length - HOLDBACK;
    const matches = findMatches(this.buffer);

    let emitted = "";
    let cursor = 0;
    let stoppedAt = safeEnd;

    for (const m of matches) {
      if (m.start >= safeEnd) break;
      if (m.end > safeEnd) {
        stoppedAt = m.start;
        break;
      }
      emitted += this.buffer.slice(cursor, m.start) + REDACTED;
      cursor = m.end;
    }

    emitted += this.buffer.slice(cursor, stoppedAt);
    this.buffer = this.buffer.slice(stoppedAt);
    return emitted;
  }
}
