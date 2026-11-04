"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClearDataDialog } from "@/components/home/ClearDataDialog";
import { Button } from "@/components/ui/Button";
import { PixelLoader } from "@/components/ui/PixelLoader";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AccuracyPanel } from "@/components/settings/AccuracyPanel";
import { clearAllData, type OcrMode } from "@/lib/db";
import { examDateFromInput, examDateInputValue, saveExamDate, saveReadingChoice } from "@/lib/notebook";
import { isNotebookError, useNotebook, useTitleCaseStoredName } from "@/lib/use-notebook";

const showDemo = process.env.NODE_ENV !== "production";

export function SettingsScreen() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearError, setClearError] = useState("");

  useEffect(() => {
    if (!leaving) return;
    clearAllData()
      .then(() => router.push("/cleared"))
      .catch(() => {
        setLeaving(false);
        setClearError("NoteWise could not clear storage on this device.");
      });
  }, [leaving, router]);

  if (clearError) {
    return (
      <main className="nw-page mx-auto w-full max-w-[720px]">
        <p className="text-lg text-ink" role="alert">
          {clearError}
        </p>
      </main>
    );
  }

  if (leaving) return <main className="min-h-dvh bg-green-600" />;

  return (
    <>
      <SettingsBody onDelete={() => setConfirmClear(true)} />
      <ClearDataDialog
        open={confirmClear}
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          setLeaving(true);
        }}
      />
    </>
  );
}

function SettingsBody({ onDelete }: { onDelete: () => void }) {
  const snapshot = useNotebook();
  const [dateError, setDateError] = useState("");
  const [demoMessage, setDemoMessage] = useState("");
  const [demoBusy, setDemoBusy] = useState(false);
  const storedName = snapshot && !isNotebookError(snapshot) ? snapshot.settings?.name : undefined;
  useTitleCaseStoredName(storedName);

  if (!snapshot) {
    return (
      <main className="nw-page mx-auto grid w-full max-w-[720px] place-items-center">
        <PixelLoader caption="Opening settings…" tone="on-paper" />
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

  const name = snapshot.settings?.name ?? "";
  const examValue = examDateInputValue(snapshot.settings?.examDate);

  async function onExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("exam-date");
    setDateError("");
    try {
      await saveExamDate(examDateFromInput(typeof value === "string" ? value : ""));
    } catch {
      setDateError("Save your name on this device before setting an exam date.");
    }
  }

  async function onDemo() {
    setDemoBusy(true);
    setDemoMessage("");
    try {
      if (process.env.NODE_ENV === "production") return;
      const { loadDemoNotes } = await import("@/lib/demo-notes");
      await loadDemoNotes();
      setDemoMessage("DEMO notes are on this device. Home cards from this load are marked DEMO.");
    } catch {
      setDemoMessage("DEMO notes could not be saved on this device.");
    } finally {
      setDemoBusy(false);
    }
  }

  return (
    <main className="nw-page mx-auto w-full max-w-[720px]">
      <p className="nw-mono text-[12px] text-muted">On this device</p>
      <div className="mt-3">
        <SectionHeading before="Your" highlight="settings" />
      </div>
      {name ? (
        <p className="mt-4 text-lg text-ink">Saved on this device as {name}.</p>
      ) : (
        <p className="mt-4 text-lg text-ink">
          Set your name on the home page first. Your name stays on this device. Cloud reading, if you choose it,
          sends a photo only when you scan.
        </p>
      )}

      <ReadingMode mode={snapshot.settings?.ocrMode ?? "cloud"} consented={snapshot.settings?.aiConsent ?? false} />
      <AccuracyPanel pages={snapshot.pages} />

      <form onSubmit={onExam} className="mt-8 flex flex-col gap-4">
        <label className="nw-mono text-[12px] text-muted" htmlFor="exam-date">
          Exam date
        </label>
        <input
          id="exam-date"
          name="exam-date"
          type="date"
          className="nw-input max-w-full"
          defaultValue={examValue}
          key={examValue}
        />
        <p className="text-base text-ink">The home countdown appears only after you save a date.</p>
        {dateError ? (
          <p className="border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink" role="alert">
            {dateError}
          </p>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button type="submit" className="w-full sm:w-auto">
            Save exam date
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => {
              setDateError("");
              saveExamDate(undefined).catch(() => {
                setDateError("The exam date could not be cleared.");
              });
            }}
          >
            Clear exam date
          </Button>
        </div>
      </form>

      {showDemo ? (
        <section className="mt-10 border-2 border-ink bg-yellow p-4 text-ink">
          <p className="nw-mono text-[12px]">Demo</p>
          <h2 className="mt-2 text-lg font-semibold">Load demo notes</h2>
          <p className="mt-2 text-base">
            Sample subjects, topics, and pages for design. This build only. It also sets a sample exam date you can
            change or clear above.
          </p>
          <div className="mt-4">
            <Button type="button" className="w-full sm:w-auto" disabled={demoBusy || !name} onClick={onDemo}>
              {demoBusy ? "Loading demo notes" : "Load demo notes"}
            </Button>
          </div>
          {demoMessage ? <p className="mt-4 text-base">{demoMessage}</p> : null}
        </section>
      ) : null}

      <div className="mt-10">
        <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={onDelete}>
          Delete all data
        </Button>
        <p className="mt-3 max-w-xl text-base text-ink">
          This also clears the choice about cloud reading. Notes stay on this device until you delete them. A Drive
          backup is not touched.
        </p>
      </div>
    </main>
  );
}

function ReadingMode({ mode, consented }: { mode: OcrMode; consented: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function choose(next: OcrMode) {
    if (next === mode) return;
    setBusy(true);
    setError("");
    try {
      await saveReadingChoice({ aiConsent: consented, ocrMode: next });
    } catch {
      setError("The reading choice could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8">
      <p className="nw-mono text-[12px] text-muted" id="reading-mode">
        Handwriting
      </p>
      <p className="mt-2 max-w-xl text-base text-ink">
        Cloud sends the photo to Google AI Studio. On-device keeps the photo on this phone. On-device handwriting
        accuracy is lower.
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row" role="group" aria-labelledby="reading-mode">
        <Button
          type="button"
          className="w-full sm:w-auto"
          variant={mode === "cloud" ? "primary" : "secondary"}
          aria-pressed={mode === "cloud"}
          disabled={busy}
          onClick={() => void choose("cloud")}
        >
          Cloud
        </Button>
        <Button
          type="button"
          className="w-full sm:w-auto"
          variant={mode === "on-device" ? "primary" : "secondary"}
          aria-pressed={mode === "on-device"}
          disabled={busy}
          onClick={() => void choose("on-device")}
        >
          On-device
        </Button>
      </div>
      {error ? (
        <p className="mt-3 border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
