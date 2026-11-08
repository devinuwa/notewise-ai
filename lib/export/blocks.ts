export type NoteBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "number"; text: string };

/** Split saved note text into paragraphs, bullets, and numbered lines. */
export function noteBlocks(text: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  let paragraph: string[] = [];

  function flush() {
    const joined = paragraph.join(" ").trim();
    paragraph = [];
    if (joined) blocks.push({ kind: "paragraph", text: joined });
  }

  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const bullet = /^(?:[-*•–])\s+(.+)$/.exec(line);
    if (bullet?.[1]) {
      flush();
      blocks.push({ kind: "bullet", text: bullet[1] });
      continue;
    }
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line);
    if (numbered?.[1]) {
      flush();
      blocks.push({ kind: "number", text: numbered[1] });
      continue;
    }
    paragraph.push(line);
  }

  flush();
  return blocks.length > 0 ? blocks : [{ kind: "paragraph", text: "This page has no text yet." }];
}
