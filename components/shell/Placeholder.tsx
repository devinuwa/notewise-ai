import { SectionHeading } from "@/components/ui/SectionHeading";

export function Placeholder({
  kicker,
  title,
  highlight,
  body,
  children,
}: {
  kicker: string;
  title: string;
  highlight: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="nw-page mx-auto w-full max-w-[1200px]">
      <p className="nw-mono text-[12px] text-muted">{kicker}</p>
      <div className="mt-3">
        <SectionHeading before={title} highlight={highlight} />
      </div>
      <p className="mt-4 max-w-xl text-lg text-ink">{body}</p>
      {children ? <div className="mt-8">{children}</div> : null}
    </main>
  );
}
