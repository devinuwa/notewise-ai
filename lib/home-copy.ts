const DAY = 86_400_000;

export function heroSubtext(pages: number, subjects: number, examDate?: number) {
  const parts: string[] = [];
  if (pages > 0) {
    const pageWord = pages === 1 ? "page" : "pages";
    const subjectWord = subjects === 1 ? "subject" : "subjects";
    parts.push(`You have digitized ${pages} ${pageWord} across ${subjects} ${subjectWord}.`);
  }
  if (examDate) {
    const days = Math.max(0, Math.round((examDate - Date.now()) / DAY));
    const when = days === 0 ? "today" : days === 1 ? "in 1 day" : `in ${days} days`;
    parts.push(`Your next JAMB practice is ${when}.`);
  }
  return parts.join(" ");
}

export function updatedLabel(updatedAt: number) {
  const days = Math.max(0, Math.round((Date.now() - updatedAt) / DAY));
  if (days === 0) return "Updated today";
  if (days === 1) return "Updated 1 day ago";
  return `Updated ${days} days ago`;
}

export function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
