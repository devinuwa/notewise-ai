import { getDb, type ChatMessage, type ChatSource } from "@/lib/db";

export function makeChatMessage(input: {
  role: ChatMessage["role"];
  text: string;
  subjectId?: string;
  sources?: ChatSource[];
}): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: input.role,
    text: input.text,
    createdAt: Date.now(),
    subjectId: input.subjectId,
    sources: input.sources,
  };
}

export async function addChatMessage(message: ChatMessage) {
  await getDb().chatMessages.add(message);
}

export async function clearChat() {
  await getDb().chatMessages.clear();
}

/** Home counts questions the student actually sent. */
export async function countTutorQuestions() {
  if (typeof indexedDB === "undefined") return 0;
  return getDb().chatMessages.where("role").equals("user").count();
}

/** One bump per Live Tutor visit that asked a question. */
export async function bumpLiveTutorSession() {
  const db = getDb();
  const existing = await db.settings.get("local");
  if (!existing?.name) return;
  await db.settings.put({
    ...existing,
    liveTutorSessions: (existing.liveTutorSessions ?? 0) + 1,
  });
}
