"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ListenProvider, useListen } from "@/components/listen/ListenProvider";
import { MiniPlayer } from "@/components/listen/MiniPlayer";
import { OcrRunner } from "@/components/shell/OcrRunner";
import { BottomNav } from "@/components/shell/BottomNav";
import { Header } from "@/components/shell/Header";
import { PixelLoader } from "@/components/ui/PixelLoader";

const SplashContext = createContext(false);

export function useSplashDone() {
  return useContext(SplashContext);
}

export function SplashGate({ children }: { children: React.ReactNode }) {
  return (
    <ListenProvider>
      <Shell>{children}</Shell>
    </ListenProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const listen = useListen();
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
  const pad = hideNav ? "min-h-dvh" : "shell-pad min-h-dvh";
  const withPlayer = listen.cues.length > 0 ? `${pad} has-listen` : pad;

  return (
    <SplashContext.Provider value={phase === "done"}>
      <OcrRunner />
      {live ? null : <Header />}
      <div id="content" className={withPlayer}>
        {children}
      </div>
      {hideNav ? null : <BottomNav />}
      <MiniPlayer />
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
