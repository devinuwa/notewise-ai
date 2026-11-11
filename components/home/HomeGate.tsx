"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { HomeScreen } from "@/components/home/HomeScreen";
import { LandingPage } from "@/components/landing/LandingPage";
import { useSplashDone } from "@/components/shell/SplashGate";
import { PixelLoader } from "@/components/ui/PixelLoader";
import { isNotebookError, useNotebook, useTitleCaseStoredName } from "@/lib/use-notebook";

/**
 * "/" shows the marketing landing until a name is saved, then My NoteWise.
 * Legacy "?start=1" redirects to /welcome. Splash stays up while Dexie loads
 * so the wrong page never flashes.
 */
export function HomeGate() {
  const ready = useSplashDone();
  const params = useSearchParams();
  const start = params.get("start") === "1";
  const snapshot = useNotebook();
  const storedName = snapshot && !isNotebookError(snapshot) ? snapshot.settings?.name : undefined;
  useTitleCaseStoredName(storedName);

  useEffect(() => {
    if (!ready || !snapshot || isNotebookError(snapshot)) return;
    const name = snapshot.settings?.name?.trim() ?? "";
    // Hard nav — soft replace can leave the landing tree mounted under /welcome.
    if (!name && start) window.location.replace("/welcome");
  }, [ready, snapshot, start]);

  if (!ready || snapshot === undefined) {
    return (
      <main className="grid min-h-dvh place-items-center bg-green-600" aria-busy="true">
        <PixelLoader caption="Opening NoteWise…" />
      </main>
    );
  }

  if (isNotebookError(snapshot)) {
    return (
      <main className="nw-page mx-auto w-full max-w-[720px]">
        <p className="text-lg text-ink" role="alert">
          {snapshot.error}
        </p>
      </main>
    );
  }

  const name = snapshot.settings?.name?.trim() ?? "";
  if (!name && start) {
    return (
      <main className="grid min-h-dvh place-items-center bg-green-600">
        <PixelLoader caption="Opening NoteWise…" />
      </main>
    );
  }
  if (!name) {
    return <LandingPage openHref="/welcome" />;
  }

  return <HomeScreen />;
}
