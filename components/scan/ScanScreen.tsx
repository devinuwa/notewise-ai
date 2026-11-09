"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
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
import { getDb } from "@/lib/db";
import { shownPages } from "@/lib/demo";
import { saveReadingChoice } from "@/lib/notebook";
import { OFFLINE_CLOUD_OCR, onlineServerSnapshot, onlineSnapshot, subscribeOnline } from "@/lib/offline";
import { kickOcrQueue } from "@/lib/ocr/queue";
import { saveScanBatch } from "@/lib/scan/save-batch";

type Step = "capture" | "place" | "consent";

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
  const online = useSyncExternalStore(subscribeOnline, onlineSnapshot, onlineServerSnapshot);
  const router = useRouter();
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
  const [place, setPlace] = useState<{ subject: string; topic: string } | null>(null);
  const saving = useRef(false);

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
      ocrBlob: prepared.ocrBlob,
      preprocessMs: prepared.preprocessMs,
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
    setNotice("");
    setSaveError("");
    setStep("capture");
  }

  async function saveAndOpen(subjectName: string, topicName: string) {
    if (saving.current) return;
    saving.current = true;
    setSaveError("");
    try {
      const saved = await saveScanBatch({
        images: pages.map((page) => ({
          imageBlob: page.imageBlob,
          ocrBlob: page.ocrBlob,
          preprocessMs: page.preprocessMs,
        })),
        subjectName,
        topicName,
      });
      const firstId = saved.pageIds[0];
      setPages((current) => {
        current.forEach(revokePage);
        return [];
      });
      kickOcrQueue();
      if (firstId) router.push(`/review/${firstId}`);
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "The pages could not be saved on this device.");
      setStep("place");
    } finally {
      saving.current = false;
    }
  }

  async function readHandwriting(subjectName: string, topicName: string) {
    setSaveError("");
    try {
      const settings = await getDb().settings.get("local");
      const wantsCloud = (settings?.ocrMode ?? "cloud") === "cloud";
      // Offline: cloud OCR cannot run — switch to on-device for this batch.
      if (wantsCloud && !online) {
        await saveReadingChoice({ aiConsent: settings?.aiConsent ?? false, ocrMode: "on-device" });
        setSaveError(OFFLINE_CLOUD_OCR);
        await saveAndOpen(subjectName, topicName);
        return;
      }
      if (wantsCloud && !settings?.aiConsent) {
        setPlace({ subject: subjectName, topic: topicName });
        setStep("consent");
        return;
      }
      await saveAndOpen(subjectName, topicName);
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "The pages could not be saved on this device.");
      setStep("place");
    }
  }

  async function chooseCloud() {
    if (!online) {
      setSaveError(OFFLINE_CLOUD_OCR);
      await chooseDevice();
      return;
    }
    await saveReadingChoice({ aiConsent: true, ocrMode: "cloud" });
    if (!place) return;
    await saveAndOpen(place.subject, place.topic);
  }

  async function chooseDevice() {
    await saveReadingChoice({ aiConsent: false, ocrMode: "on-device" });
    if (!place) return;
    await saveAndOpen(place.subject, place.topic);
  }

  async function retryStored(id: string) {
    await getDb().notePages.update(id, { ocrStatus: "queued", ocrError: "" });
    kickOcrQueue();
    router.push(`/review/${id}`);
  }

  const subjects = notebook && !isNotebookError(notebook) ? notebook.subjects : [];
  const topics = notebook && !isNotebookError(notebook) ? notebook.topics : [];
  const failedStored =
    notebook && !isNotebookError(notebook)
      ? shownPages(notebook.pages).filter((page) => page.ocrStatus === "error")
      : [];

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
                  <p>{page.ocrError || "This page could not be read. The photo is still saved."}</p>
                  <div className="mt-3">
                    <Button type="button" variant="secondary" onClick={() => void retryStored(page.id)}>
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
