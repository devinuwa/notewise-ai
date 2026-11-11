"use client";

import { Onboarding } from "@/components/home/Onboarding";
import { useSplashDone } from "@/components/shell/SplashGate";
import { PixelLoader } from "@/components/ui/PixelLoader";
import { saveStudentName } from "@/lib/notebook";
import { isNotebookError, useNotebook } from "@/lib/use-notebook";
import { useEffect } from "react";

/** Dedicated name step — hard-nav CTAs from landing avoid soft-nav leftovers. */
export default function WelcomePage() {
  const ready = useSplashDone();
  const snapshot = useNotebook();

  useEffect(() => {
    if (!ready || !snapshot || isNotebookError(snapshot)) return;
    if (snapshot.settings?.name?.trim()) {
      window.location.replace("/");
    }
  }, [ready, snapshot]);

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

  if (snapshot.settings?.name?.trim()) {
    return (
      <main className="grid min-h-dvh place-items-center bg-green-600">
        <PixelLoader caption="Opening your notebook…" />
      </main>
    );
  }

  return (
    <Onboarding
      onSave={async (name) => {
        await saveStudentName(name);
        // Hard load so HomeGate does not sit under a stale /welcome tree.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional full reload
        window.location.assign("/");
      }}
    />
  );
}
