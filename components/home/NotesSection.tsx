import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";
import { updatedLabel } from "@/lib/home-copy";
import type { NoteCard } from "@/lib/notebook";

export function NotesSection({
  cards,
  reduce,
}: {
  cards: NoteCard[];
  reduce: boolean;
}) {
  return (
    <section className="mx-auto w-full max-w-[1200px] px-4 py-12 sm:px-6">
      <Reveal reduce={reduce} delay={0.32}>
        <SectionHeading before="Your" highlight="Notes" />
      </Reveal>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, index) => (
          <Reveal key={card.id} reduce={reduce} delay={0.4 + index * 0.06}>
            <Card className="flex h-full min-w-0 flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <span
                  aria-hidden
                  className="block h-12 w-12 shrink-0 border-2 border-ink"
                  style={{ background: card.color }}
                />
                <div className="flex max-w-full flex-wrap justify-end gap-2">
                  {card.demo ? (
                    <span className="nw-mono border-2 border-ink bg-yellow px-2 py-1 text-[12px] text-ink">Demo</span>
                  ) : null}
                  <Chip status={card.status} />
                </div>
              </div>
              <div className="min-w-0">
                {card.title !== card.subject ? (
                  <p className="nw-mono text-[12px] text-muted">{card.subject}</p>
                ) : null}
                <h3 className="nw-display mt-2 text-[clamp(26px,6vw,40px)] text-ink">{card.title}</h3>
              </div>
              <p className="mt-auto text-base text-ink">
                {card.pageCount} {card.pageCount === 1 ? "page" : "pages"}
                {card.pageCount > 0 ? ` · ${updatedLabel(card.updatedAt)}` : ""}
              </p>
            </Card>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
