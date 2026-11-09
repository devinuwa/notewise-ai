import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";

export default function OfflinePage() {
  return (
    <main className="nw-page mx-auto w-full max-w-[720px]">
      <p className="nw-mono text-[12px] text-muted">Offline</p>
      <div className="mt-3">
        <SectionHeading before="You are" highlight="offline" />
      </div>
      <p className="mt-4 text-lg text-ink">
        This page has not been opened on this device yet. Notes, listen, saved quizzes, and earlier tutor chats still
        work from pages you have already visited.
      </p>
      <Link href="/" className="nw-btn mt-6 inline-flex">
        Back to Home
      </Link>
    </main>
  );
}
