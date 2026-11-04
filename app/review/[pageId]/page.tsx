"use client";

import { useParams } from "next/navigation";
import { ReviewScreen } from "@/components/review/ReviewScreen";

export default function ReviewPage() {
  const params = useParams<{ pageId: string }>();
  const pageId = Array.isArray(params.pageId) ? params.pageId[0] : params.pageId;
  return <ReviewScreen pageId={pageId ?? ""} />;
}
