"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { accuracyStats, statsParagraph } from "@/lib/accuracy";
import type { NotePage } from "@/lib/db";

export function AccuracyPanel({ pages }: { pages: NotePage[] }) {
  const stats = accuracyStats(pages);
  const [copied, setCopied] = useState("");
  const paragraph = statsParagraph(stats);

  async function copy() {
    try {
      await navigator.clipboard.writeText(paragraph);
      setCopied("Copied. Paste it into your proposal.");
    } catch {
      setCopied("Copy failed. Select the numbers below and copy them yourself.");
    }
  }

  return (
    <section className="mt-10 border-2 border-ink bg-paper p-4">
      <h2 className="nw-mono text-[12px] text-muted">Stats</h2>
      <dl className="mt-3 grid gap-2 text-base text-ink">
        <div>
          <dt className="font-semibold">Pages digitized</dt>
          <dd>{stats.digitized}</dd>
        </div>
        <div>
          <dt className="font-semibold">Flagged words fixed</dt>
          <dd>{stats.flagsFixed}</dd>
        </div>
        <div>
          <dt className="font-semibold">Cloud accuracy before correction</dt>
          <dd>{line(stats.cloud.average, stats.cloud.pages)}</dd>
        </div>
        <div>
          <dt className="font-semibold">On-device accuracy before correction</dt>
          <dd>{line(stats.device.average, stats.device.pages)}</dd>
        </div>
        <div>
          <dt className="font-semibold">Average seconds per page</dt>
          <dd>{stats.averageSeconds === null ? "No timed pages yet" : `${stats.averageSeconds.toFixed(1)} s`}</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-ink">
        Accuracy is one minus the word edits between the original reading and the final text, divided by the final
        word count.
      </p>
      <div className="mt-4">
        <Button type="button" variant="secondary" onClick={() => void copy()}>
          Copy stats
        </Button>
      </div>
      {copied ? <p className="mt-3 text-base text-ink">{copied}</p> : null}
      <pre className="mt-3 whitespace-pre-wrap text-sm text-ink">{paragraph}</pre>
    </section>
  );
}

function line(average: number | null, pages: number) {
  if (average === null) return "No corrected pages yet";
  const count = pages === 1 ? "1 page" : `${pages} pages`;
  return `${Math.round(average * 100)}% across ${count}`;
}
