"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import { ActivitiesSection } from "@/components/home/ActivitiesSection";
import { WeakTopics } from "@/components/home/WeakTopics";
import { ClearDataDialog } from "@/components/home/ClearDataDialog";
import { EmptyNotebook } from "@/components/home/EmptyNotebook";
import { Hero } from "@/components/home/Hero";
import { NotesSection } from "@/components/home/NotesSection";
import { useSplashDone } from "@/components/shell/SplashGate";
import { PixelLoader } from "@/components/ui/PixelLoader";
import { ProfileBar } from "@/components/ui/ProfileBar";
import { Reveal } from "@/components/motion/Reveal";
import { exportAllData } from "@/lib/backup";
import { clearAllData } from "@/lib/db";
import { shownPages, shownSubjects, shownTopics, withoutDemoPages, withoutDemoSubjects } from "@/lib/demo";
import { heroSubtext } from "@/lib/home-copy";
import { activityProgress, noteCards } from "@/lib/notebook";
import { finishedQuizQuestions } from "@/lib/practice/store";
import { countTutorQuestions } from "@/lib/tutor/store";
import { isNotebookError, useNotebook, useTitleCaseStoredName } from "@/lib/use-notebook";

function subscribeReduced(onChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function reducedSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function HomeBody({ onClear }: { onClear: () => void }) {
  const ready = useSplashDone();
  const reduce = useSyncExternalStore(subscribeReduced, reducedSnapshot, () => false);
  const snapshot = useNotebook();
  const asked = useLiveQuery(() => countTutorQuestions()) ?? 0;
  const quizzed = useLiveQuery(() => finishedQuizQuestions()) ?? 0;
  const [exportError, setExportError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const storedName = snapshot && !isNotebookError(snapshot) ? snapshot.settings?.name : undefined;
  useTitleCaseStoredName(storedName);

  if (!ready) {
    return <main className="min-h-dvh bg-green-600" />;
  }

  if (!snapshot) {
    return (
      <main className="grid min-h-dvh place-items-center bg-green-600">
        <PixelLoader caption="Opening your notebook…" />
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
  if (!name) {
    // HomeGate should have routed here only with a name; keep a quiet loader as a guard.
    return (
      <main className="grid min-h-dvh place-items-center bg-green-600">
        <PixelLoader caption="Opening your notebook…" />
      </main>
    );
  }

  const countedPages = withoutDemoPages(snapshot.pages);
  const countedSubjects = withoutDemoSubjects(snapshot.subjects);
  const pages = shownPages(snapshot.pages);
  const cards = noteCards(shownSubjects(snapshot.subjects), shownTopics(snapshot.topics), pages);
  const activities = activityProgress(countedPages, asked, quizzed);
  const subtext = heroSubtext(countedPages.length, countedSubjects.length, snapshot.settings?.examDate);

  return (
    <main>
      <Hero name={name} subtext={subtext} reduce={reduce} />
      <div className="relative z-10 mx-auto -mt-8 w-full max-w-[1200px] px-4 sm:px-6">
        <Reveal reduce={reduce} delay={0.28}>
          <ProfileBar
            name={name}
            exportError={exportError}
            onExport={() => {
              setExportError("");
              exportAllData().catch(() => {
                setExportError("The backup file could not be saved. Try again.");
              });
            }}
            onClear={() => setConfirmClear(true)}
          />
        </Reveal>
      </div>
      {pages.length === 0 ? <EmptyNotebook reduce={reduce} /> : <NotesSection cards={cards} reduce={reduce} />}
      <WeakTopics reduce={reduce} />
      <ActivitiesSection activities={activities} reduce={reduce} />
      <ClearDataDialog
        open={confirmClear}
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          onClear();
        }}
      />
    </main>
  );
}

export function HomeScreen() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    if (!leaving) return;
    clearAllData()
      .then(() => router.push("/cleared"))
      .catch(() => {
        setLeaving(false);
        setStorageError("NoteWise could not clear storage on this device.");
      });
  }, [leaving, router]);

  if (storageError) {
    return (
      <main className="nw-page mx-auto w-full max-w-[720px]">
        <p className="text-lg text-ink" role="alert">
          {storageError}
        </p>
      </main>
    );
  }

  if (leaving) {
    return <main className="min-h-dvh bg-green-600" />;
  }

  return <HomeBody onClear={() => setLeaving(true)} />;
}
