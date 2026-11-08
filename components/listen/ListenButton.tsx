"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useListen } from "@/components/listen/ListenProvider";
import { buildCues } from "@/lib/listen/cues";
import type { NotePage, Topic } from "@/lib/db";

export function ListenButton({
  subjectName,
  pages,
  topics,
}: {
  subjectName: string;
  pages: NotePage[];
  topics: Topic[];
}) {
  const { start } = useListen();
  const cues = useMemo(() => buildCues(pages, topics, subjectName), [pages, topics, subjectName]);
  const pending = pages.filter((page) => page.status !== "digitized");
  const reviewed = pages.length - pending.length;
  const firstPending = pending[0];

  return (
    <div className="mt-4">
      <Button type="button" disabled={cues.length === 0} onClick={() => start(cues)}>
        Listen
      </Button>
      {reviewed === 0 && firstPending ? (
        <p className="mt-3 text-sm text-ink">
          Review a page first.{" "}
          <Link className="font-semibold underline" href={`/review/${firstPending.id}`}>
            Review them first
          </Link>
        </p>
      ) : null}
      {reviewed > 0 && cues.length === 0 ? (
        <p className="mt-3 text-sm text-ink">The reviewed pages have no text to read yet.</p>
      ) : null}
      {reviewed > 0 && cues.length > 0 && pending.length > 0 ? (
        <p className="mt-3 text-sm text-ink">
          {pending.length === 1 ? "1 page still needs review" : `${pending.length} pages still need review`}, so{" "}
          {pending.length === 1 ? "it is" : "they are"} left out.
        </p>
      ) : null}
    </div>
  );
}
