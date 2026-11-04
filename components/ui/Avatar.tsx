import { initialsFromName } from "@/lib/home-copy";

export function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-ink bg-green-600 font-mono text-sm font-bold text-paper"
    >
      {initialsFromName(name)}
    </span>
  );
}
