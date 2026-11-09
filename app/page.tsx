import type { Metadata } from "next";
import { Suspense } from "react";
import { HomeGate } from "@/components/home/HomeGate";
import { SplashScreen } from "@/components/shell/SplashScreen";
import { SITE_TAGLINE, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: {
    absolute: "NoteWise AI — Your notebook, made smarter",
  },
  description: SITE_TAGLINE,
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: "NoteWise AI",
    description: SITE_TAGLINE,
    url: SITE_URL,
  },
};

export default function HomePage() {
  return (
    <Suspense fallback={<SplashScreen />}>
      <HomeGate />
    </Suspense>
  );
}
