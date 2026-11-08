type TutorEvent = { text: string } | { done: true } | { error: true };

function eventOf(line: string): TutorEvent | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  const data = trimmed.slice(5).trim();
  if (!data || data === "[DONE]") return { done: true };
  const payload = JSON.parse(data) as { text?: unknown; done?: unknown; error?: unknown };
  if (payload.error) return { error: true };
  if (payload.done === true) return { done: true };
  if (typeof payload.text === "string" && payload.text) return { text: payload.text };
  return null;
}

function merge(previous: string, piece: string) {
  if (!piece) return previous;
  if (piece.startsWith(previous)) return piece;
  return previous + piece;
}

/** Reads the tutor event stream. A split line is kept for the next chunk. */
export async function readTutorStream(response: Response, onText: (full: string) => void) {
  if (!response.body) throw new Error("The tutor could not answer just now.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let done = false;

  try {
    while (!done) {
      const next = await reader.read();
      if (next.done) break;
      buffer += decoder.decode(next.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        let event: TutorEvent | null;
        try {
          event = eventOf(line);
        } catch {
          continue;
        }
        if (!event) continue;
        if ("error" in event) throw new Error("The tutor stopped while answering.");
        if ("done" in event) {
          done = true;
          continue;
        }
        full = merge(full, event.text);
        onText(full);
      }
    }
  } finally {
    reader.releaseLock();
  }

  return full.trim();
}
