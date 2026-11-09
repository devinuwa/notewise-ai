import type { FeatureStatus } from "@/lib/landing/content";

export function StatusChip({ status }: { status: FeatureStatus }) {
  const live = status === "live";
  return (
    <span
      className={`nw-mono inline-flex min-h-8 items-center rounded-[2px] border-2 border-ink px-2 text-[10px] ${
        live ? "bg-yellow text-ink" : "bg-chip-idle text-ink"
      }`}
    >
      {live ? "Live" : "Coming soon"}
    </span>
  );
}
