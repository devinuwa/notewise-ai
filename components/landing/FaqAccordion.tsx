"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { FAQ_ITEMS } from "@/lib/landing/content";

export function FaqAccordion() {
  const baseId = useId();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto mt-8 max-w-3xl divide-y-2 divide-ink border-2 border-ink bg-paper shadow-[6px_6px_0_var(--shadow)]">
      {FAQ_ITEMS.map((item, index) => {
        const expanded = open === index;
        const panelId = `${baseId}-panel-${index}`;
        const buttonId = `${baseId}-button-${index}`;
        return (
          <div key={item.q}>
            <h3>
              <button
                type="button"
                id={buttonId}
                className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left text-base font-semibold text-ink"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => setOpen(expanded ? null : index)}
              >
                <span>{item.q}</span>
                <ChevronDown
                  aria-hidden
                  size={20}
                  className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!expanded}
              className="px-4 pb-4 text-base text-muted"
            >
              <p>{item.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
