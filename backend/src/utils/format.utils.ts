export type SpanOptions = {
  maxSpanLength?: number;
  maxSpans?: number;
  prependPrompt?: string;
  normalizeWhitespace?: boolean;
};

export function buildSpansFromText(
  text: string,
  opts: SpanOptions = {}
): string[] {
  const {
    maxSpanLength = 800,
    maxSpans = 3000,
    prependPrompt,
    normalizeWhitespace = true,
  } = opts;

  const rawLines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const lines = normalizeWhitespace
    ? rawLines.map((l) => l.replace(/\s+/g, " "))
    : rawLines;

  const spans: string[] = [];
  let current = "";

  for (const line of lines) {
    if (!current.length) {
      current = line.slice(0, maxSpanLength);
      continue;
    }

    if (current.length + 1 + line.length <= maxSpanLength) {
      current += " " + line;
    } else {
      spans.push(current);
      current = line.slice(0, maxSpanLength);
      if (spans.length >= maxSpans) break;
    }
  }
  if (current && spans.length < maxSpans) spans.push(current);

  if (prependPrompt) {
    spans.unshift(prependPrompt.slice(0, maxSpanLength));
  }

  return spans.slice(0, maxSpans);
}

export function makeLLMInputFromText(text: string, opts?: SpanOptions): string {
  const spans = buildSpansFromText(text, opts);
  return JSON.stringify({ text: spans });
}
