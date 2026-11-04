"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { PixelLoader } from "@/components/ui/PixelLoader";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { BatchStrip } from "@/components/scan/BatchStrip";
import { CropEditor } from "@/components/scan/CropEditor";
import { LiveCamera } from "@/components/scan/LiveCamera";
import { PlaceStep } from "@/components/scan/PlaceStep";
import { PAGE_LIMIT, type CropJob, type DraftPage } from "@/components/scan/types";
import { useLiveCameraAvailable } from "@/components/scan/useLiveCameraAvailable";
import { isNotebookError, useNotebook } from "@/lib/use-notebook";
import { newId } from "@/lib/scan/ids";
import type { PreparedPage } from "@/lib/scan/prepare-image";
import { workingPhoto } from "@/lib/scan/prepare-image";
import { OcrConsentDialog } from "@/components/scan/OcrConsentDialog";
import { getDb, type OcrMode } from "@/lib/db";
import { shownPages } from "@/lib/demo";
import { saveReadingChoice } from "@/lib/notebook";
import { readSavedPages, type PageRead } from "@/lib/ocr/queue";
import { saveScanBatch } from "@/lib/scan/save-batch";

type Step = "capture" | "place" | "consent" | "reading" | "saved";

type ReadReport = {
  total: number;
  cloud: number;
  device: number;
  fallback: number;
  failures: { id: string; error: string }[];
};

function freshReport(reads: PageRead[]): ReadReport {
  const report: ReadReport = { total: reads.length, cloud: 0, device: 0, fallback: 0, failures: [] };
  for (const read of reads) {
    if (!read.ok) report.failures.push({ id: read.id, error: read.error });
    else if (read.provider === "gemini") report.cloud += 1;
    else if (read.usedFallback) report.fallback += 1;
    else report.device += 1;
  }
  return report;
}

function withRetry(current: ReadReport, read: PageRead): ReadReport {
  const report: ReadReport = {
    ...current,
    failures: current.failures.filter((item) => item.id !== read.id),
  };
  if (!read.ok) report.failures = [...report.failures, { id: read.id, error: read.error }];
  else if (read.provider === "gemini") report.cloud += 1;
  else if (read.usedFallback) report.fallback += 1;
  else report.device += 1;
  return report;
}

type CropQueue = {
  active: CropJob | null;
  pending: CropJob[];
};

function isImage(file: File) {
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.name);
}

function revokePage(page: DraftPage) {
  URL.revokeObjectURL(page.sourceUrl);
  URL.revokeObjectURL(page.previewUrl);
}

export function ScanScreen() {
  const notebook = useNotebook();
  const liveCamera = useLiveCameraAvailable();
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const retakeId = useRef<string | null>(null);
  const [pages, setPages] = useState<DraftPage[]>([]);
  const [cropQueue, setCropQueue] = useState<CropQueue>({ active: null, pending: [] });
  const [cameraOpen, setCameraOpen] = useState(false);
  const [step, setStep] = useState<Step>("capture");
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [progress, setProgress] = useState({ current: 1, total: 1 });
  const [report, setReport] = useState<ReadReport | null>(null);

  function reservedNewPages(queue: CropQueue) {
    const activeNew = queue.active && !queue.active.replaceId ? 1 : 0;
    return activeNew + queue.pending.filter((job) => !job.replaceId).length;
  }

  function pushJobs(jobs: CropJob[]) {
    setCropQueue((current) => {
      if (!current.active && jobs.length > 0) {
        const [active, ...rest] = jobs;
        return { active, pending: [...current.pending, ...rest] };
      }
      return { ...current, pending: [...current.pending, ...jobs] };
    });
  }

  function advanceCrop(current: CropQueue) {
    const [active, ...pending] = current.pending;
    return { active: active ?? null, pending };
  }

  async function addFiles(files: File[], replaceId?: string) {
    const chosen = replaceId ? files.slice(0, 1) : files.filter(isImage);
    if (files.length > 0 && chosen.length === 0) {
      setNotice("NoteWise could not use that file. Choose a photo.");
      return;
    }
    const room = replaceId ? chosen.length : PAGE_LIMIT - pages.length - reservedNewPages(cropQueue);
    const accepted = chosen.slice(0, Math.max(0, room));
    if (!replaceId && chosen.length > accepted.length) {
      setNotice("This batch holds 20 pages. The extra photos were left out.");
    } else if (accepted.length > 0) {
      setNotice("");
    }
    if (accepted.length === 0) {
      if (!replaceId && pages.length >= PAGE_LIMIT) {
        setNotice("This batch already has 20 pages. Delete one to add another.");
      }
      return;
    }

    const jobs: CropJob[] = [];
    try {
      for (const file of accepted) {
        const working = await workingPhoto(file);
        jobs.push({
          id: replaceId ?? newId(),
          sourceBlob: working.blob,
          sourceUrl: working.url,
          replaceId,
          ownsSource: true,
        });
      }
    } catch (caught) {
      jobs.forEach((job) => URL.revokeObjectURL(job.sourceUrl));
      setNotice(caught instanceof Error ? caught.message : "NoteWise could not open that photo.");
      return;
    }
    pushJobs(jobs);
  }

  function onInput(event: React.ChangeEvent<HTMLInputElement>, replace: boolean) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    const replacing = replace ? retakeId.current : null;
    retakeId.current = null;
    void addFiles(files, replacing ?? undefined);
  }

  function onCropConfirm(prepared: PreparedPage) {
    const job = cropQueue.active;
    if (!job) return;
    const previewUrl = URL.createObjectURL(prepared.imageBlob);
    const nextPage: DraftPage = {
      id: job.replaceId ?? job.id,
      sourceUrl: job.sourceUrl,
      sourceBlob: job.sourceBlob,
      cropBlob: prepared.cropBlob,
      imageBlob: prepared.imageBlob,
      previewUrl,
    };
    setPages((current) => {
      if (!job.replaceId) return [...current, nextPage];
      return current.map((page) => {
        if (page.id !== job.replaceId) return page;
        URL.revokeObjectURL(page.previewUrl);
        if (page.sourceUrl !== nextPage.sourceUrl) URL.revokeObjectURL(page.sourceUrl);
        return nextPage;
      });
    });
    setCropQueue((current) => advanceCrop(current));
  }

  function onCropCancel() {
    const job = cropQueue.active;
    if (job?.ownsSource) URL.revokeObjectURL(job.sourceUrl);
    setCropQueue((current) => advanceCrop(current));
  }

  function clearBatch() {
    setPages((current) => {
      current.forEach(revokePage);
      return [];
    });
    setCropQueue((current) => {
      if (current.active) URL.revokeObjectURL(current.active.sourceUrl);
      current.pending.forEach((job) => URL.revokeObjectURL(job.sourceUrl));
      return { active: null, pending: [] };
    });
    setPendingIds([]);
    setReport(null);
    setNotice("");
    setSaveError("");
    setStep("capture");
  }

  async function runQueue(ids: string[], mode: OcrMode, retrying: boolean) {
    setStep("reading");
    setProgress({ current: 1, total: Math.max(1, ids.length) });
    const reads = await readSavedPages(ids, mode, (current, total) => {
      setProgress({ current, total });
    });
    setReport((current) => {
      if (retrying && current) return reads.reduce(withRetry, current);
      return freshReport(reads);
    });
    setStep("saved");
  }

  async function beginReading(ids: string[], retrying: boolean) {
    const settings = await getDb().settings.get("local");
    const mode = settings?.ocrMode ?? "cloud";
    if (mode === "cloud" && !settings?.aiConsent) {
      setPendingIds(ids);
      setStep("consent");
      return;
    }
    await runQueue(ids, mode, retrying);
  }

  async function readHandwriting(subjectName: string, topicName: string) {
    setSaveError("");
    setStep("reading");
    setProgress({ current: 1, total: Math.max(1, pages.length) });
    try {
      const saved = await saveScanBatch({
        images: pages.map((page) => ({ imageBlob: page.imageBlob })),
        subjectName,
        topicName,
      });
      setPages((current) => {
        current.forEach(revokePage);
        return [];
      });
      setPendingIds(saved.pageIds);
      await beginReading(saved.pageIds, false);
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "The pages could not be saved on this device.");
      setStep("place");
    }
  }

  async function chooseCloud() {
    await saveReadingChoice({ aiConsent: true, ocrMode: "cloud" });
    await runQueue(pendingIds, "cloud", false);
  }

  async function chooseDevice() {
    await saveReadingChoice({ aiConsent: false, ocrMode: "on-device" });
    await runQueue(pendingIds, "on-device", false);
  }

  const subjects = notebook && !isNotebookError(notebook) ? notebook.subjects : [];
  const topics = notebook && !isNotebookError(notebook) ? notebook.topics : [];
  const failedStored =
    notebook && !isNotebookError(notebook) ? shownPages(notebook.pages).filter((page) => page.ocrError) : [];

  return (
    <main className="nw-page mx-auto w-full max-w-[1200px]">
      {step === "capture" ? (
        <>
          <p className="nw-mono text-[12px] text-muted">Scan</p>
          <div className="mt-3">
            <SectionHeading before="Point the camera at a" highlight="page" />
          </div>
          <p className="mt-4 max-w-xl text-lg text-ink">
            Crop each page and choose where it belongs. The photo is stored on this device. Cloud reading sends it
            to Google AI Studio after you agree. On-device reading stays on this phone and is less accurate.
          </p>
          <div className="mt-8 flex max-w-md flex-col gap-3">
            <Button
              type="button"
              className="min-h-16 w-full"
              onClick={() => {
                retakeId.current = null;
                cameraInput.current?.click();
              }}
            >
              Take photo
            </Button>
            <Button type="button" variant="secondary" className="w-full" onClick={() => galleryInput.current?.click()}>
              Choose from gallery
            </Button>
            {liveCamera ? (
              <Button type="button" variant="secondary" className="w-full" onClick={() => setCameraOpen(true)}>
                Live camera
              </Button>
            ) : null}
          </div>
          <input
            ref={cameraInput}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => onInput(event, true)}
          />
          <input
            ref={galleryInput}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => onInput(event, false)}
          />
          {notice ? (
            <p className="mt-4 max-w-xl border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink" role="status">
              {notice}
            </p>
          ) : null}
          <div className="mt-8 min-w-0">
            <BatchStrip
              pages={pages}
              onMove={(index, direction) => {
                setPages((current) => {
                  const next = index + direction;
                  if (next < 0 || next >= current.length) return current;
                  const copy = [...current];
                  const [item] = copy.splice(index, 1);
                  copy.splice(next, 0, item);
                  return copy;
                });
              }}
              onDelete={(id) => {
                setPages((current) => {
                  const page = current.find((item) => item.id === id);
                  if (page) revokePage(page);
                  return current.filter((item) => item.id !== id);
                });
              }}
              onCrop={(id) => {
                const page = pages.find((item) => item.id === id);
                if (!page) return;
                pushJobs([
                  {
                    id: page.id,
                    sourceUrl: page.sourceUrl,
                    sourceBlob: page.sourceBlob,
                    replaceId: page.id,
                    ownsSource: false,
                  },
                ]);
              }}
              onRetake={(id) => {
                retakeId.current = id;
                cameraInput.current?.click();
              }}
            />
          </div>
          {failedStored.length > 0 ? (
            <ul className="mt-8 flex max-w-xl flex-col gap-3">
              {failedStored.map((page) => (
                <li key={page.id} className="border-2 border-ink bg-yellow px-3 py-3 text-ink">
                  <p>{page.ocrError}</p>
                  <div className="mt-3">
                    <Button type="button" variant="secondary" onClick={() => void beginReading([page.id], false)}>
                      Retry
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-8">
            <Button type="button" className="w-full sm:w-auto" disabled={pages.length === 0} onClick={() => setStep("place")}>
              Where does this belong?
            </Button>
          </div>
        </>
      ) : null}

      {step === "place" ? (
        notebook && isNotebookError(notebook) ? (
          <p className="text-lg text-ink" role="alert">
            {notebook.error}
          </p>
        ) : !notebook ? (
          <PixelLoader caption="Opening your notebook…" tone="on-paper" />
        ) : (
          <PlaceStep
            subjects={subjects}
            topics={topics}
            pageCount={pages.length}
            error={saveError}
            onBack={() => setStep("capture")}
            onSave={(subjectName, topicName) => void readHandwriting(subjectName, topicName)}
          />
        )
      ) : null}

      {step === "consent" ? (
        <p className="max-w-xl text-lg text-ink">Photos are saved on this device. Choose how to read them.</p>
      ) : null}

      {step === "reading" ? (
        <div className="grid min-h-64 place-items-center">
          <PixelLoader caption={`Reading page ${progress.current} of ${progress.total}`} tone="on-paper" />
        </div>
      ) : null}

      {step === "saved" && report ? (
        <section>
          <p className="nw-mono text-[12px] text-muted">Saved</p>
          <div className="mt-3">
            <SectionHeading before="Pages saved for" highlight="review" />
          </div>
          <p className="mt-4 max-w-xl text-lg text-ink">
            Saved {report.total} {report.total === 1 ? "page" : "pages"} on this device for review.
          </p>
          {report.cloud > 0 ? (
            <p className="mt-3 max-w-xl text-lg text-ink">
              Cloud reading sent {report.cloud} {report.cloud === 1 ? "photo" : "photos"} to Google AI Studio.
            </p>
          ) : null}
          {report.device > 0 ? (
            <p className="mt-3 max-w-xl text-lg text-ink">
              On-device reading kept {report.device} {report.device === 1 ? "photo" : "photos"} on this phone.
              Handwriting accuracy is lower.
            </p>
          ) : null}
          {report.fallback > 0 ? (
            <p className="mt-3 max-w-xl border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink" role="status">
              Cloud reading did not finish, so {report.fallback} {report.fallback === 1 ? "page was" : "pages were"}{" "}
              read on this phone. Handwriting accuracy is lower.
            </p>
          ) : null}
          {report.failures.length > 0 ? (
            <ul className="mt-4 flex max-w-xl flex-col gap-3">
              {report.failures.map((failure) => (
                <li key={failure.id} className="border-2 border-ink bg-yellow px-3 py-3 text-ink">
                  <p>{failure.error}</p>
                  <div className="mt-3">
                    <Button type="button" variant="secondary" onClick={() => void beginReading([failure.id], true)}>
                      Retry
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button type="button" className="w-full sm:w-auto" onClick={clearBatch}>
              Scan another batch
            </Button>
            <Button href="/" variant="secondary" className="w-full sm:w-auto">
              Back to my notes
            </Button>
          </div>
        </section>
      ) : null}

      <OcrConsentDialog
        open={step === "consent"}
        onContinue={() => void chooseCloud()}
        onDeviceOnly={() => void chooseDevice()}
      />

      {cameraOpen ? (
        <LiveCamera
          onClose={() => setCameraOpen(false)}
          onUnavailable={(message) => {
            setCameraOpen(false);
            setNotice(message);
          }}
          onCapture={(blob) => {
            setCameraOpen(false);
            const replacing = retakeId.current;
            retakeId.current = null;
            void addFiles([new File([blob], "page.jpg", { type: "image/jpeg" })], replacing ?? undefined);
          }}
        />
      ) : null}

      {cropQueue.active ? (
        <CropEditor
          key={cropQueue.active.sourceUrl}
          sourceUrl={cropQueue.active.sourceUrl}
          onCancel={onCropCancel}
          onConfirm={onCropConfirm}
        />
      ) : null}
    </main>
  );
}
