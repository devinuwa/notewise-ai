"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const OrbCanvas = dynamic(
  () => import("@/components/live/OrbCanvas").then((mod) => mod.OrbCanvas),
  { ssr: false, loading: () => <OrbFallback /> },
);

function subscribeReduced(onChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function reducedSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function OrbFallback() {
  return (
    <div
      className="mx-auto aspect-square w-[140px] rounded-full border-2 border-ink bg-[radial-gradient(circle_at_30%_30%,#e97b77,#8bb2de_45%,#2e4742)]"
      role="img"
      aria-label="Live Tutor orb"
    />
  );
}

/** Dark band with a small Live Tutor orb. Pauses when off-screen or reduced motion. */
export function LiveTutorSpotlight() {
  const reduce = useSyncExternalStore(subscribeReduced, reducedSnapshot, () => true);
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const paused = reduce || !visible;

  return (
    <section className="border-y-2 border-ink bg-green-800 px-4 py-16 text-paper sm:px-6" aria-labelledby="live-tutor-heading">
      <div className="mx-auto grid w-full max-w-[1200px] items-center gap-8 md:grid-cols-[160px_1fr]">
        <div ref={hostRef} className="mx-auto w-[140px]">
          {paused ? <OrbFallback /> : <OrbCanvas phase="idle" level={0.2} reducedMotion={false} maxPx={140} />}
        </div>
        <div>
          <p className="nw-mono text-[12px] text-paper">Live Tutor</p>
          <h2 id="live-tutor-heading" className="nw-display mt-2 text-[clamp(28px,6vw,56px)] text-paper">
            Talk through your notes <span className="text-blue">aloud.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-paper">
            A voice conversation that answers from pages you already reviewed — with sources you can open.
          </p>
        </div>
      </div>
    </section>
  );
}
