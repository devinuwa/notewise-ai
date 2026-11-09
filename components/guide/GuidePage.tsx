import Link from "next/link";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { PhoneFrame } from "@/components/landing/PhoneFrame";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";

const STEPS = [
  {
    title: "Scan",
    body: "Open Scan. Take a photo or choose from your gallery. Crop close to the writing, pick a subject and topic, then start reading.",
    image: "/landing/scan.webp",
    alt: "Scan screen with photo capture options",
  },
  {
    title: "Crop",
    body: "Use the crop box and rotate controls so only one page of writing remains. Dark pen on plain paper works best.",
    image: "/landing/scan.webp",
    alt: "Scan flow where pages are cropped before reading",
  },
  {
    title: "Review",
    body: "Open any needs-review page. Fix flagged words or edit the full text. Save when it matches what you wrote.",
    image: "/landing/review.webp",
    alt: "Review screen for correcting OCR text",
  },
  {
    title: "Listen",
    body: "From a digitised page or subject, start Listen. Use the sticky mini-player for play, pause, and speed.",
    image: "/landing/library.webp",
    alt: "Library where you open notes to listen",
  },
  {
    title: "Ask",
    body: "Open Tutor. Ask in chat, or start Live Tutor for a voice conversation. Answers cite your notes.",
    image: "/landing/tutor.webp",
    alt: "Tutor chat screen",
  },
  {
    title: "Practise",
    body: "Open Practice. Choose a subject, generate questions from your notes, and review weak topics after you finish.",
    image: "/landing/practice.webp",
    alt: "Practice quiz setup screen",
  },
  {
    title: "Exam mode",
    body: "Upload a past paper (JAMB, WAEC, NECO, or Junior WAEC). NoteWise builds a style profile, then writes new questions from your notes.",
    image: "/landing/practice.webp",
    alt: "Practice screen including exam-style options",
  },
  {
    title: "Backup and restore",
    body: "In Settings, connect Google Drive (optional). Back up creates a NoteWise folder. Restore pulls that backup onto this device.",
    image: "/landing/home.webp",
    alt: "Home screen where Settings leads to Drive backup",
  },
  {
    title: "Install",
    body: "Add NoteWise to your home screen so the shell loads offline. Android Chrome: Install app. iPhone Safari: Share → Add to Home Screen.",
    image: "/landing/home.webp",
    alt: "Home screen after NoteWise is installed",
  },
] as const;

const TIPS = [
  "Use daylight or a bright lamp — avoid a hard shadow across the page.",
  "Hold the phone parallel to the notebook so lines stay straight.",
  "One page per photo. Crop close to the text.",
  "Dark pen on plain paper reads more clearly than pencil on lined pages.",
] as const;

const TROUBLE = [
  {
    title: "Camera not opening",
    body: "Use Take photo or Choose from gallery — those work without a live camera. Live camera needs HTTPS (or localhost) and permission.",
  },
  {
    title: "Text unreadable",
    body: "Retake with better light, crop tighter, and fix flagged words on Review. Cloud reading is stronger on handwriting; on-device is a fallback.",
  },
  {
    title: "Voice missing",
    body: "Listen and Live Tutor use the browser’s speech voices. Install a system voice pack, or pick another voice in Settings.",
  },
  {
    title: "Drive popup blocked",
    body: "Allow pop-ups for NoteWise, then try Connect again. Sign in with the Google account that should own the backup folder.",
  },
  {
    title: "App not updating",
    body: "Open Settings → About → Check for updates. When a banner says a new version is ready, tap Reload after you finish editing or a quiz.",
  },
] as const;

export function GuidePage() {
  return (
    <div className="bg-page text-ink">
      <LandingHeader openHref="/?start=1" />
      <main id="content" className="mx-auto w-full max-w-[960px] px-4 py-12 sm:px-6">
        <p className="nw-mono text-[12px] text-muted">Guide</p>
        <div className="mt-3">
          <SectionHeading before="How to use" highlight="NoteWise" />
        </div>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          Step-by-step from first photo to backup. Keep the review step — you stay in charge of the text.
        </p>

        <ol className="mt-12 space-y-12">
          {STEPS.map((step, index) => (
            <li key={step.title} className="grid gap-6 border-2 border-ink bg-paper p-5 shadow-[6px_6px_0_var(--shadow)] md:grid-cols-[200px_1fr]">
              <PhoneFrame src={step.image} alt={step.alt} width={390} height={844} />
              <div>
                <p className="nw-mono text-[12px] text-muted">Step {String(index + 1).padStart(2, "0")}</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">{step.title}</h2>
                <p className="mt-3 text-base text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <aside className="mt-14 border-2 border-ink bg-yellow p-5 shadow-[6px_6px_0_var(--shadow)]" aria-labelledby="photo-tips">
          <h2 id="photo-tips" className="nw-mono text-[12px] text-ink">
            Photo tips
          </h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-ink">
            {TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </aside>

        <section className="mt-14" aria-labelledby="trouble-heading">
          <h2 id="trouble-heading" className="nw-display text-[clamp(28px,6vw,48px)] text-ink">
            Troubleshooting
          </h2>
          <div className="mt-6 grid gap-4">
            {TROUBLE.map((item) => (
              <article key={item.title} className="border-2 border-ink bg-paper p-4 shadow-[4px_4px_0_var(--shadow)]">
                <h3 className="text-lg font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-base text-muted">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="mt-12 flex flex-wrap gap-3">
          <Button href="/?start=1">Open NoteWise</Button>
          <Button href="/privacy" variant="secondary">
            Privacy
          </Button>
          <Link href="/about" className="nw-btn nw-btn-secondary">
            About
          </Link>
        </div>
      </main>
    </div>
  );
}
