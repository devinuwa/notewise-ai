"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CorrectionEditor } from "@/components/review/ReviewScreen";
import { PageImage } from "@/components/review/PageImage";
import { Button } from "@/components/ui/Button";
import { PixelLoader } from "@/components/ui/PixelLoader";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getDb } from "@/lib/db";
import { readExamSheet } from "@/lib/exam/read";
import { markSheetReviewed, saveSheetDraft } from "@/lib/exam/store";

export function ExamReviewScreen({ sheetId }: { sheetId: string }) {
  const sheet = useLiveQuery(() => getDb().examSheets.get(sheetId), [sheetId]);
  const paper = useLiveQuery(async () => {
    const row = await getDb().examSheets.get(sheetId);
    if (!row) return null;
    return (await getDb().examPapers.get(row.paperId)) ?? null;
  }, [sheetId]);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let live = true;
    void getDb()
      .examSheets.get(sheetId)
      .then((row) => {
        if (live && !row) setMissing(true);
      })
      .catch(() => {
        if (live) setMissing(true);
      });
    return () => {
      live = false;
    };
  }, [sheetId]);

  useEffect(() => {
    if (!sheet || sheet.ocrStatus !== "queued") return;
    void readExamSheet(sheet.id);
  }, [sheet]);

  if (!sheet && !missing) {
    return (
      <main className="nw-page mx-auto grid w-full max-w-[1100px] place-items-center">
        <PixelLoader caption="Opening this page…" tone="on-paper" />
      </main>
    );
  }

  if (!sheet || !paper) {
    return (
      <main className="nw-page mx-auto w-full max-w-[720px]">
        <p className="text-lg text-ink">That page is not on this device.</p>
        <div className="mt-6">
          <Button href="/practice">Back to exam mode</Button>
        </div>
      </main>
    );
  }

  const back = `/practice?paper=${paper.id}`;
  const kicker = `${paper.examBody} · ${paper.subjectName} · ${paper.year} · page ${sheet.pageNumber}`;
  const waiting = sheet.ocrStatus === "queued" || sheet.ocrStatus === "reading";

  if (waiting) {
    return (
      <main className="nw-page mx-auto w-full max-w-[1100px]">
        <p className="nw-mono text-[12px] text-muted">{kicker}</p>
        <div className="mt-3">
          <SectionHeading before="Check this" highlight="page" />
        </div>
        <div className="mt-6 grid items-start gap-6 md:grid-cols-2">
          <PageImage blob={sheet.imageBlob} label={kicker} />
          <PixelLoader caption={sheet.ocrStatus === "queued" ? "Queued" : "Reading"} tone="on-paper" />
        </div>
      </main>
    );
  }

  const emptyPhoto =
    sheet.source === "pdf-text" ? "This page was copied from the PDF. There is no photo." : undefined;

  return (
    <CorrectionEditor
      key={`${sheet.id}-${sheet.ocrStatus}`}
      page={sheet}
      kicker={kicker}
      doneLabel="Done, keep this reading"
      doneCaption="Saved on this device"
      doneHref={back}
      doneLinkLabel="Back to exam mode"
      backLabel="Back to exam mode"
      backHref={back}
      showIndexHint={false}
      emptyPhoto={emptyPhoto}
      minText={20}
      notice={sheet.ocrError || undefined}
      saveDraft={(draft) => saveSheetDraft(sheet.id, draft)}
      markDone={(draft) => markSheetReviewed(sheet.id, draft)}
    />
  );
}
