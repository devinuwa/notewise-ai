import type { Metadata } from "next";
import { GuidePage } from "@/components/guide/GuidePage";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "How to use NoteWise",
  description: "Step-by-step guide: scan, crop, review, listen, ask, practise, exam mode, backup, and install.",
  alternates: { canonical: `${SITE_URL}/guide` },
  openGraph: {
    title: "How to use NoteWise AI",
    description: "Scan handwritten notes, check the text, then listen, ask, and practise.",
    url: `${SITE_URL}/guide`,
  },
};

export default function GuideRoute() {
  return <GuidePage />;
}
