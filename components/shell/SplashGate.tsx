"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/shell/BottomNav";
import { Header } from "@/components/shell/Header";
import { PixelLoader } from "@/components/ui/PixelLoader";

const SplashContext = createContext(false);

export function useSplashDone() {
  return useContext(SplashContext);
}

export function SplashGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [phase, setPhase] = useState<"splash" | "exit" | "done">("splash");

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const exitAt = window.setTimeout(() => setPhase("exit"), 600);
    const doneAt = window.setTimeout(() => setPhase("done"), reduce ? 860 : 1160);
    return () => {
      window.clearTimeout(exitAt);
      window.clearTimeout(doneAt);
    };
  }, []);

  const live = pathname === "/tutor/live";
  const hideNav = live || pathname === "/cleared" || phase !== "done";

  return (
    <SplashContext.Provider value={phase === "done"}>
      {live ? null : <Header />}
      <div id="content" className={hideNav ? "min-h-dvh" : "shell-pad min-h-dvh"}>
        {children}
      </div>
      {hideNav ? null : <BottomNav />}
      {phase === "done" ? null : (
        <div
          className={phase === "exit" ? "splash is-leaving" : "splash"}
          role="status"
          aria-live="polite"
          aria-label="Loading NoteWise"
        >
          <PixelLoader />
        </div>
      )}
    </SplashContext.Provider>
  );
}
