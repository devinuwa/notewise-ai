"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Reveal } from "@/components/motion/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { weakTopics } from "@/lib/practice/store";

export function WeakTopics({ reduce }: { reduce: boolean }) {
  const rows = useLiveQuery(weakTopics);
  if (!rows || rows.length === 0) return null;
  return (
    <section className="mx-auto w-full max-w-[1200px] px-4 pb-4 sm:px-6">
      <Reveal reduce={reduce} delay={0.44}>
        <SectionHeading before="Weak" highlight="topics" />
      </Reveal>
      <ul className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {rows.map((row) => (
          <li key={row.topic}>
            <Link className="nw-chip min-h-11 bg-yellow text-ink" href="/practice">
              {row.topic} · {row.missed} missed
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
