import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { SITE_TAGLINE, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: SITE_TAGLINE,
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: "About NoteWise AI",
    description: SITE_TAGLINE,
    url: `${SITE_URL}/about`,
  },
};

export default function AboutPage() {
  return <LandingPage openHref="/?start=1" />;
}
