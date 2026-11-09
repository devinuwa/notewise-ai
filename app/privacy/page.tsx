import type { Metadata } from "next";
import Link from "next/link";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What NoteWise keeps on your device, what is sent to AI services, and how to delete everything.",
  alternates: { canonical: `${SITE_URL}/privacy` },
  openGraph: {
    title: "Privacy · NoteWise AI",
    description: "Local-first notes. No account. Clear rules for AI and Drive.",
    url: `${SITE_URL}/privacy`,
  },
};

export default function PrivacyPage() {
  return (
    <div className="bg-page text-ink">
      <LandingHeader openHref="/?start=1" />
      <main id="content" className="mx-auto w-full max-w-[720px] px-4 py-12 sm:px-6">
        <p className="nw-mono text-[12px] text-muted">Privacy</p>
        <div className="mt-3">
          <SectionHeading before="Your notes," highlight="your device" />
        </div>
        <p className="mt-4 text-lg text-ink">
          NoteWise is local-first. There are no accounts, no ads, and no analytics tracking. This page explains what
          stays on the phone and what leaves it.
        </p>

        <section className="mt-8">
          <h2 className="nw-mono text-[12px] text-muted">On this device</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-base text-ink">
            <li>
              Your name, subjects, topics, page photos, OCR text, quizzes, attempts, and tutor chat history stay in
              IndexedDB on this browser.
            </li>
            <li>The on-device embedding model (for search) downloads once and is cached in the browser.</li>
            <li>Listen uses the built-in speech voices on the device. Nothing is uploaded for reading aloud.</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="nw-mono text-[12px] text-muted">Sent to an AI service</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-base text-ink">
            <li>
              <strong>Cloud reading (optional):</strong> when you choose Cloud reading and scan a page, the photo is
              sent from the server route to Google AI Studio so handwriting can be transcribed. The API key never ships
              to the browser.
            </li>
            <li>
              <strong>Tutor and quiz generation:</strong> when you ask a new tutor question or generate a new quiz,
              short text from your notes (and your question) is sent so the model can answer. Older chats and saved
              quizzes stay readable offline.
            </li>
            <li>On-device reading keeps photos on the phone and does not call the cloud OCR route.</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="nw-mono text-[12px] text-muted">You review first</h2>
          <p className="mt-3 text-base text-ink">
            Every scanned page goes through Review before it is treated as digitised study material. You can fix flagged
            words or edit the full text. Search, Tutor, and practice use the text you approved.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="nw-mono text-[12px] text-muted">Google Drive backup</h2>
          <p className="mt-3 text-base text-ink">
            Drive uses Google Identity Services with the{" "}
            <code className="nw-mono text-[12px] normal-case tracking-normal">drive.file</code> scope only. NoteWise can
            only see files it created (a NoteWise folder and backup JSON, plus optional page photos). The access token
            stays in memory and is revoked when you disconnect. Past papers are included only if you ticked that option.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="nw-mono text-[12px] text-muted">Delete everything</h2>
          <p className="mt-3 text-base text-ink">
            Use <strong>Delete all data</strong> on Home or in Settings. That clears the local notebook and reading
            choice on this device. It does not delete a Google Drive backup you already made, and it does not delete
            anything a cloud AI service may already have processed.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="nw-mono text-[12px] text-muted">No ads, no tracking</h2>
          <p className="mt-3 text-base text-ink">
            NoteWise does not show ads and does not send analytics beacons. Sharing the app link uses a simple Open Graph
            image only.
          </p>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button href="/?start=1">Open NoteWise</Button>
          <Button href="/guide" variant="secondary">
            How to use
          </Button>
          <Link href="/about" className="nw-btn nw-btn-secondary">
            About
          </Link>
        </div>
      </main>
    </div>
  );
}
