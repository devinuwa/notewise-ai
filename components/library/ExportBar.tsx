"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { PixelLoader } from "@/components/ui/PixelLoader";
import { getDb, type NotePage, type Subject, type Topic } from "@/lib/db";
import { buildDocx } from "@/lib/export/docx";
import { exportFileName } from "@/lib/export/filename";
import { buildPdf } from "@/lib/export/pdf";
import { canShareFile, openFile, shareOrDownload } from "@/lib/export/save-file";
import { exportSections, pendingPages, reviewedPages } from "@/lib/export/scope";

type Kind = "pdf" | "docx";
type Phase = "idle" | "ask" | "working" | "done" | "error";

export function ExportBar({
  subject,
  topic,
  pages,
  topics,
}: {
  subject: Subject;
  topic?: Topic;
  pages: NotePage[];
  topics: Topic[];
}) {
  const [photos, setPhotos] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [kind, setKind] = useState<Kind>("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [shareable, setShareable] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      setFile(null);
    };
  }, []);

  const pending = pendingPages(pages);
  const ready = reviewedPages(pages);
  const reviewId = pending[0]?.id;

  async function build(nextKind: Kind) {
    setKind(nextKind);
    setPhase("working");
    setError("");
    try {
      const settings = await getDb().settings.get("local");
      const sections = exportSections(pages, topics, topic);
      if (sections.length === 0) {
        setPhase("ask");
        return;
      }
      const made = new Date();
      const dateLabel = new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(made);
      const studentName = settings?.name || "Student";
      const bytes =
        nextKind === "pdf"
          ? await buildPdf({
              subject: subject.name,
              topic: topic?.name,
              studentName,
              dateLabel,
              sections,
              includePhotos: photos,
            })
          : await buildDocx({ subject: subject.name, sections });
      const name = exportFileName(subject.name, topic?.name, nextKind, made);
      const type =
        nextKind === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const nextFile = new File([bytes instanceof Blob ? bytes : new Uint8Array(bytes)], name, { type });
      setFile(nextFile);
      setShareable(canShareFile(nextFile));
      setPhase("done");
    } catch {
      setError("The file could not be made on this device. Try again.");
      setPhase("error");
    }
  }

  function request(nextKind: Kind) {
    setKind(nextKind);
    setError("");
    if (pending.length > 0) {
      setPhase("ask");
      return;
    }
    void build(nextKind);
  }

  if (phase === "working") {
    return (
      <div className="mt-4">
        <PixelLoader caption={kind === "pdf" ? "Making your PDF..." : "Making your Word file..."} tone="on-paper" />
      </div>
    );
  }

  if (phase === "done" && file) {
    const label = kind === "pdf" ? "PDF" : "Word file";
    return (
      <div className="mt-4 border-2 border-ink bg-paper p-4">
        <p className="text-lg text-ink" role="status">
          Your {label} is ready.
        </p>
        <p className="mt-1 text-sm text-ink">{file.name}</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Button type="button" onClick={() => openFile(file)}>
            Open
          </Button>
          <Button type="button" variant="secondary" onClick={() => void shareOrDownload(file)}>
            {shareable ? "Share" : "Download"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setPhase("idle")}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {phase === "ask" ? (
        <div className="mb-4 border-2 border-ink bg-yellow px-3 py-3 text-ink" role="status">
          <p>
            {pending.length === 1 ? "1 page still needs review." : `${pending.length} pages still need review.`}{" "}
            {ready.length > 0 ? "Reviewed pages can be exported now." : "Review a page before exporting."}
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            {reviewId ? (
              <Button href={`/review/${reviewId}`} variant="secondary">
                Review them first
              </Button>
            ) : null}
            <Button type="button" disabled={ready.length === 0} onClick={() => void build(kind)}>
              Export reviewed pages only
            </Button>
            <Button type="button" variant="secondary" onClick={() => setPhase("idle")}>
              Not now
            </Button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p className="mb-3 border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button type="button" onClick={() => request("pdf")}>
          Export PDF
        </Button>
        <Button type="button" variant="secondary" onClick={() => request("docx")}>
          Export Word
        </Button>
      </div>
      <label className="mt-3 flex items-start gap-2 text-sm text-ink">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-ink"
          checked={photos}
          onChange={(event) => setPhotos(event.target.checked)}
        />
        Include photos of original pages
      </label>
    </div>
  );
}
