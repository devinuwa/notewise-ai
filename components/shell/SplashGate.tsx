"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { usePathname, useSearchParams } from "next/navigation";
import { ListenProvider, useListen } from "@/components/listen/ListenProvider";
import { MiniPlayer } from "@/components/listen/MiniPlayer";
import { OcrRunner } from "@/components/shell/OcrRunner";
import { BottomNav } from "@/components/shell/BottomNav";
import { Header } from "@/components/shell/Header";
import { PixelLoader } from "@/components/ui/PixelLoader";
import { getDb } from "@/lib/db";

const SplashContext = createContext(false);

export function useSplashDone() {
  return useContext(SplashContext);
}

const MARKETING_PATHS = new Set(["/about", "/guide", "/privacy"]);

export function SplashGate({ children }: { children: React.ReactNode }) {
  return (
    <ListenProvider>
      <Shell>{children}</Shell>
    </ListenProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const listen = useListen();
  const [phase, setPhase] = useState<"splash" | "exit" | "done">("splash");
  // Object wrapper so "no settings row yet" is distinct from "still loading".
  const profile = useLiveQuery(async () => {
    const row = await getDb().settings.get("local");
    return { name: row?.name?.trim() ?? "" };
  });
  const hasProfile = Boolean(profile?.name);
  const profileKnown = profile !== undefined;
  const starting = pathname === "/" && searchParams.get("start") === "1";

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
  const marketing =
    MARKETING_PATHS.has(pathname) ||
    (pathname === "/" && profileKnown && !hasProfile) ||
    (pathname === "/" && starting && !hasProfile);
  const hideAppChrome = live || pathname === "/cleared" || marketing || phase !== "done";
  const hideNav = hideAppChrome;
  const pad = hideNav ? "min-h-dvh" : "shell-pad min-h-dvh";
  const withPlayer = !live && !marketing && listen.cues.length > 0 ? `${pad} has-listen` : pad;

  return (
    <SplashContext.Provider value={phase === "done"}>
      <OcrRunner />
      {hideAppChrome ? null : <Header />}
      <div id={marketing ? undefined : "content"} className={withPlayer}>
        {children}
      </div>
      {hideNav ? null : <BottomNav />}
      {live || marketing ? null : <MiniPlayer />}
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
