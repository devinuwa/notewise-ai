/** Windows file names reject these characters, and a trailing dot is easy to lose. */
export function safeFilePart(value: string) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 80);
}

export function exportDateStamp(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function exportFileName(subject: string, topic: string | undefined, extension: "pdf" | "docx", date = new Date()) {
  const parts = [safeFilePart(subject)];
  const topicPart = topic ? safeFilePart(topic) : "";
  if (topicPart) parts.push(topicPart);
  parts.push(exportDateStamp(date));
  return `${parts.join(" - ")}.${extension}`;
}
