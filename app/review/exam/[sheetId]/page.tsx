"use client";

import { useParams } from "next/navigation";
import { ExamReviewScreen } from "@/components/exam/ExamReviewScreen";

export default function ExamReviewPage() {
  const params = useParams<{ sheetId: string }>();
  const sheetId = Array.isArray(params.sheetId) ? params.sheetId[0] : params.sheetId;
  return <ExamReviewScreen sheetId={sheetId ?? ""} />;
}
