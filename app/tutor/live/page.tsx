import { Button } from "@/components/ui/Button";

export default function LiveTutorPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-green-800 to-ink px-4 py-16 text-center text-paper">
      <p className="nw-mono text-[12px] text-paper">Live Tutor</p>
      <h1 className="nw-display mt-4 max-w-3xl text-[clamp(28px,8vw,64px)] text-paper">
        The tutor room stays dark.
      </h1>
      <p className="mt-4 max-w-md text-lg text-paper">
        Voice, the colour orb, and answers from your notes are a later step.
      </p>
      <div className="mt-8">
        <Button href="/tutor">Back to Tutor</Button>
      </div>
    </main>
  );
}
