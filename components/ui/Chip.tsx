import { Check, X } from "lucide-react";
import { NOTE_STATUS_LABEL, type NoteStatus } from "@/lib/status";

const STYLE: Record<NoteStatus, string> = {
  digitized: "bg-green-600 text-paper",
  "needs-review": "bg-yellow text-ink",
  "backed-up": "bg-blue text-ink",
  "not-started": "bg-chip-idle text-ink",
};

export function Chip({ status }: { status: NoteStatus }) {
  return (
    <span className={`nw-chip ${STYLE[status]}`}>
      {status === "digitized" ? <Check aria-hidden size={14} strokeWidth={3} /> : null}
      {status === "not-started" ? <X aria-hidden size={14} strokeWidth={3} /> : null}
      {NOTE_STATUS_LABEL[status]}
    </span>
  );
}
