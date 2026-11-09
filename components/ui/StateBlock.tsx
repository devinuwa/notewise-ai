import { PixelLoader } from "@/components/ui/PixelLoader";

/** Shared empty / loading / error panels so screens stay consistent. */
export function LoadingState({ caption, tone = "on-paper" }: { caption: string; tone?: "on-green" | "on-paper" }) {
  return (
    <div className="grid min-h-[40vh] place-items-center px-4">
      <PixelLoader caption={caption} tone={tone} />
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <p className="border-2 border-ink bg-yellow px-3 py-3 text-base text-ink" role="alert">
      {message}
    </p>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-2 border-ink bg-paper px-4 py-5 text-ink shadow-[4px_4px_0_var(--shadow)]">
      <p className="nw-mono text-[12px] text-muted">{title}</p>
      <p className="mt-2 text-base">{body}</p>
    </div>
  );
}
