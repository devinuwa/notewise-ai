"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ExamSummary } from "@/components/exam/ExamSummary";
import { Button } from "@/components/ui/Button";
import { PixelLoader } from "@/components/ui/PixelLoader";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getDb, type ExamProfile, type ExamSheet } from "@/lib/db";
import { EXAM_PAGE_CAP, EXAM_TEXT_CAP, EXAM_YEAR_MAX, EXAM_YEAR_MIN, examBodies, isExamBody } from "@/lib/exam/bodies";
import { pagesFromPdf } from "@/lib/exam/pdf";
import { readExamSheet } from "@/lib/exam/read";
import { paperText, removePaper, replaceProfile, saveNewPaper, setPaperBackup, type NewExamSheet } from "@/lib/exam/store";
import type { ExamStyle } from "@/lib/practice/check";

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PHOTO_MAX = 6 * 1024 * 1024;
const PDF_MAX = 8 * 1024 * 1024;

function sheetLabel(sheet: ExamSheet) {
  if (sheet.ocrStatus === "queued" || sheet.ocrStatus === "reading") return "Reading";
  if (sheet.ocrStatus === "error") return "Could not read";
  if (sheet.status === "digitized") return "Checked";
  if (sheet.source === "pdf-text") return "Text copied from the PDF";
  return "Check this page";
}

export function ExamMode({
  subjectNames,
  readySubjects,
  busy,
  onPractice,
}: {
  subjectNames: string[];
  readySubjects: { id: string; name: string }[];
  busy: boolean;
  onPractice: (input: { subjectId: string; style: ExamStyle; styleLabel: string }) => void;
}) {
  const params = useSearchParams();
  const requested = params.get("paper") ?? "";
  const papers = useLiveQuery(() => getDb().examPapers.orderBy("createdAt").reverse().toArray(), []);
  const [openId, setOpenId] = useState(requested);
  const [examBody, setExamBody] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [year, setYear] = useState("");
  const [includeInDrive, setIncludeInDrive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [fileKey, setFileKey] = useState(0);
  const [caption, setCaption] = useState("");
  const [working, setWorking] = useState<"upload" | "analyse" | "">("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);

  const selectedId = openId || requested;
  const sheets = useLiveQuery(async () => {
    if (!selectedId) return [];
    const rows = await getDb().examSheets.where("paperId").equals(selectedId).toArray();
    return rows.sort((left, right) => left.pageNumber - right.pageNumber);
  }, [selectedId]);
  const profile = useLiveQuery(async () => {
    if (!selectedId) return null;
    const rows = await getDb().examProfiles.where("paperId").equals(selectedId).toArray();
    return rows.sort((left, right) => right.createdAt - left.createdAt)[0] ?? null;
  }, [selectedId]);
  const paper = papers?.find((item) => item.id === selectedId);

  async function upload() {
    if (working || busy) return;
    setError("");
    setNote("");
    const body = examBody.trim();
    const subject = subjectName.trim();
    const parsedYear = Number(year);
    if (!isExamBody(body) || subject.length < 2 || subject.length > 80) {
      setError("Choose the exam body and type the subject.");
      return;
    }
    if (!Number.isInteger(parsedYear) || parsedYear < EXAM_YEAR_MIN || parsedYear > EXAM_YEAR_MAX) {
      setError(`Use a year from ${EXAM_YEAR_MIN} to ${EXAM_YEAR_MAX}.`);
      return;
    }
    if (files.length === 0) {
      setError("Add photos or one PDF.");
      return;
    }
    const pdfs = files.filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    const photos = files.filter((file) => PHOTO_TYPES.has(file.type));
    if (pdfs.length > 0 && photos.length > 0) {
      setError("Upload photos or one PDF.");
      return;
    }
    if (pdfs.length > 1) {
      setError("Upload one PDF.");
      return;
    }
    if (pdfs.length === 0 && photos.length !== files.length) {
      setError("Use JPEG, PNG, or WebP photos, or one PDF.");
      return;
    }
    if (photos.some((file) => file.size > PHOTO_MAX)) {
      setError("One photo is larger than 6 MB. Take a smaller photo.");
      return;
    }
    if (pdfs[0] && pdfs[0].size > PDF_MAX) {
      setError("That PDF is larger than 8 MB. Photograph the pages, or split the file.");
      return;
    }

    setWorking("upload");
    try {
      let nextSheets: NewExamSheet[] = [];
      let extra = "";
      if (pdfs[0]) {
        setCaption("Opening the PDF…");
        const read = await pagesFromPdf(pdfs[0], (page, total) => setCaption(`Reading page ${page} of ${total}…`));
        if (read.truncated) extra = `Only the first ${EXAM_PAGE_CAP} pages were used.`;
        nextSheets = read.pages.map((page) => ({
          pageNumber: page.pageNumber,
          imageBlob: page.imageBlob,
          text: page.text,
          rawOcrText: page.source === "pdf-text" ? page.text : "",
          source: page.source,
          ocrStatus: page.source === "pdf-text" ? "ready" : "queued",
          ocrProvider: page.source === "pdf-text" ? "pdf-text" : "",
        }));
      } else {
        const used = photos.slice(0, EXAM_PAGE_CAP);
        if (photos.length > EXAM_PAGE_CAP) extra = `Only the first ${EXAM_PAGE_CAP} photos were used.`;
        nextSheets = used.map((file, index) => ({
          pageNumber: index + 1,
          imageBlob: file,
          text: "",
          rawOcrText: "",
          source: "photo",
          ocrStatus: "queued",
          ocrProvider: "",
        }));
      }

      const saved = await saveNewPaper({
        examBody: body,
        subjectName: subject,
        year: parsedYear,
        includeInDrive,
        sheets: nextSheets,
      });
      setOpenId(saved.paperId);
      setFiles([]);
      setFileKey((value) => value + 1);
      setIncludeInDrive(false);
      for (let index = 0; index < saved.sheetIds.length; index += 1) {
        if (nextSheets[index]?.ocrStatus !== "queued") continue;
        setCaption(`Reading page ${index + 1}…`);
        await readExamSheet(saved.sheetIds[index] ?? "");
      }
      setNote(extra);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That file could not be read.");
    } finally {
      setWorking("");
      setCaption("");
    }
  }

  async function analyse() {
    if (!paper || !sheets || working || busy) return;
    if (sheets.length === 0 || sheets.some((sheet) => sheet.status !== "digitized")) {
      setError("Check every page before you look at the pattern.");
      return;
    }
    const text = paperText(sheets);
    if (text.trim().length < 40) {
      setError("The reading is too short to describe this paper. Check the pages again.");
      return;
    }
    setError("");
    setCaption("Looking at how this paper asks…");
    setWorking("analyse");
    try {
      const sliced = text.slice(0, EXAM_TEXT_CAP);
      const response = await fetch("/api/llm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "exam-profile",
          examBody: paper.examBody,
          subject: paper.subjectName,
          year: paper.year,
          text: sliced,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: unknown; profile?: ExamProfile } | null;
      const draft = payload?.profile;
      if (
        !response.ok ||
        !draft ||
        !draft.questionTypes ||
        !draft.difficultyMix ||
        !Array.isArray(draft.topics) ||
        draft.topics.length === 0 ||
        !Array.isArray(draft.wordingPatterns) ||
        !Array.isArray(draft.samples) ||
        draft.samples.length === 0
      ) {
        const message = payload && typeof payload.error === "string" ? payload.error : "The paper pattern could not be read.";
        throw new Error(message);
      }
      await replaceProfile({
        ...draft,
        id: crypto.randomUUID(),
        paperId: paper.id,
        examBody: paper.examBody,
        subjectName: paper.subjectName,
        year: paper.year,
        includeInDrive: paper.includeInDrive,
        createdAt: Date.now(),
      });
      if (text.length > sliced.length) {
        setNote("Only the first part of this paper was used, so the pattern is based on that.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The paper pattern could not be read.");
    } finally {
      setWorking("");
      setCaption("");
    }
  }

  const checked = sheets?.length ? sheets.every((sheet) => sheet.status === "digitized") : false;

  return (
    <section className="mt-10 border-t-2 border-ink pt-8">
      <p className="nw-mono text-[12px] text-muted">Exam mode</p>
      <div className="mt-3">
        <SectionHeading before="Practice in an exam" highlight="style" />
      </div>
      <p className="mt-4 max-w-xl border-2 border-ink bg-paper px-4 py-3 text-ink">
        Past papers belong to the exam bodies. This is for your own revision.
      </p>
      <p className="mt-4 max-w-xl text-base text-ink">
        Upload a past paper you already have. Photos are read the same way as your notes. A PDF page with selectable text stays in the
        browser. Then practice from your reviewed notes in that style.
      </p>

      <form
        className="mt-6 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void upload();
        }}
      >
        <label>
          <span className="nw-mono text-[12px] text-muted">Exam body</span>
          <select className="nw-input mt-2 w-full" value={examBody} onChange={(event) => setExamBody(event.target.value)}>
            <option value="">Choose</option>
            {examBodies.map((body) => (
              <option key={body} value={body}>
                {body}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="nw-mono text-[12px] text-muted">Subject</span>
          <input
            className="nw-input mt-2 w-full"
            list="exam-subjects"
            value={subjectName}
            onChange={(event) => setSubjectName(event.target.value)}
          />
          <datalist id="exam-subjects">
            {subjectNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
        <label>
          <span className="nw-mono text-[12px] text-muted">Year</span>
          <input
            className="nw-input mt-2 w-full"
            inputMode="numeric"
            value={year}
            onChange={(event) => setYear(event.target.value)}
          />
        </label>
        <label>
          <span className="nw-mono text-[12px] text-muted">Past questions</span>
          <input
            className="mt-2 block w-full text-sm text-ink file:mr-3 file:border-2 file:border-ink file:bg-paper file:px-3 file:py-2 file:font-mono file:text-[12px] file:text-ink"
            type="file"
            key={fileKey}
            accept="image/jpeg,image/png,image/webp,application/pdf"
            multiple
            onChange={(event) => setFiles([...(event.target.files ?? [])])}
          />
        </label>
        <label className="flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            className="mt-1 size-5 border-2 border-ink accent-ink"
            checked={includeInDrive}
            onChange={(event) => setIncludeInDrive(event.target.checked)}
          />
          <span>
            Include this past paper in a backup
            <span className="mt-1 block">Left unticked, it stays on this device. The JSON export leaves it out.</span>
          </span>
        </label>
        {working === "upload" ? <PixelLoader caption={caption || "Reading…"} tone="on-paper" /> : <Button type="submit">Read this paper</Button>}
      </form>

      {error ? (
        <p className="mt-4 border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink" role="alert">
          {error}
        </p>
      ) : null}
      {note ? <p className="mt-4 text-sm text-ink">{note}</p> : null}

      {papers && papers.length > 0 ? (
        <div className="mt-8">
          <p className="nw-mono text-[12px] text-muted">Papers on this device</p>
          <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {papers.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`nw-chip min-h-11 shrink-0 ${item.id === selectedId ? "bg-ink text-paper" : "bg-paper text-ink"}`}
                  aria-pressed={item.id === selectedId}
                  onClick={() => {
                    setOpenId(item.id);
                    setConfirmRemove(false);
                    setError("");
                  }}
                >
                  {item.examBody} {item.subjectName} {item.year}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {paper && sheets ? (
        <div className="mt-4">
          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-1 size-5 border-2 border-ink accent-ink"
              checked={paper.includeInDrive}
              onChange={(event) => void setPaperBackup(paper.id, event.target.checked)}
            />
            <span>Include this past paper in a backup</span>
          </label>
          <ul className="mt-4 grid gap-3">
            {sheets.map((sheet) => (
              <li key={sheet.id} className="border-2 border-ink bg-paper px-3 py-3">
                <p className="nw-mono text-[12px] text-muted">Page {sheet.pageNumber}</p>
                <p className="mt-1 text-ink">{sheetLabel(sheet)}</p>
                <div className="mt-3">
                  <Link className="font-semibold underline" href={`/review/exam/${sheet.id}`}>
                    Check page {sheet.pageNumber}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            {working === "analyse" ? (
              <PixelLoader caption={caption || "Reading…"} tone="on-paper" />
            ) : (
              <Button type="button" disabled={!checked || working !== ""} onClick={() => void analyse()}>
                See what this exam tests
              </Button>
            )}
          </div>
          {profile ? (
            <ExamSummary profile={profile} readySubjects={readySubjects} busy={busy || working !== ""} onPractice={onPractice} />
          ) : null}
          {confirmRemove ? (
            <div className="mt-4 border-2 border-ink bg-yellow px-3 py-3 text-ink">
              <p>Remove this paper from this device?</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => {
                    void removePaper(paper.id).then(() => {
                      setOpenId("");
                      setConfirmRemove(false);
                    });
                  }}
                >
                  Remove
                </Button>
                <Button type="button" variant="secondary" onClick={() => setConfirmRemove(false)}>
                  Keep it
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <Button type="button" variant="secondary" onClick={() => setConfirmRemove(true)}>
                Remove from this device
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
