import Link from "next/link";
import { FaqAccordion } from "@/components/landing/FaqAccordion";
import { FourSquare } from "@/components/landing/FourSquare";
import { InstallPromptButton } from "@/components/landing/InstallPromptButton";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LiveTutorSpotlight } from "@/components/landing/LiveTutorSpotlight";
import { PhoneFrame } from "@/components/landing/PhoneFrame";
import { StatusChip } from "@/components/landing/StatusChip";
import { Button } from "@/components/ui/Button";
import { PixelStairs } from "@/components/ui/PixelStairs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CREATOR_NAME } from "@/lib/creator";
import {
  AUDIENCE,
  HERO_SHOT,
  HOW_STEPS,
  LANDING_FEATURES,
  PROBLEM_CARDS,
} from "@/lib/landing/content";
import { LANDING_STATS } from "@/lib/landing-stats";
import { SITE_NAME } from "@/lib/site";

export function LandingPage({ openHref = "/welcome" }: { openHref?: string }) {
  return (
    <div className="bg-page text-ink">
      <LandingHeader openHref={openHref} />
      <main id="content">
        {/* 1. Hero */}
        <section className="relative overflow-hidden border-b-2 border-ink bg-green-600 text-paper">
          <PixelStairs corner="tl" />
          <PixelStairs corner="tr" />
          <div className="relative z-10 mx-auto grid w-full max-w-[1200px] items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <FourSquare size={28} />
              <h1 className="nw-display mt-6 max-w-[18ch] text-[clamp(40px,9vw,96px)] text-paper">
                Your notebook, made <span className="text-blue">smarter.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-paper">
                Photograph your handwritten notes. NoteWise turns them into text you can search, listen to, ask
                questions about, and practise from. Free. No account.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button href={openHref} hard>
                  Start free
                </Button>
                <Button href="#how" variant="secondary">
                  See how it works
                </Button>
              </div>
            </div>
            <PhoneFrame
              src={HERO_SHOT.src}
              alt={HERO_SHOT.alt}
              width={HERO_SHOT.width}
              height={HERO_SHOT.height}
              priority
            />
          </div>
        </section>

        {/* 2. Problem */}
        <section className="border-b-2 border-ink bg-page px-4 py-16 sm:px-6">
          <div className="mx-auto w-full max-w-[1200px]">
            <SectionHeading before="Most of what you learn is written in books that get" highlight="lost" />
            <p className="mt-4 max-w-2xl text-lg text-muted">
              Torn pages, no search, and quiet revision — paper alone does not keep up with exam season.
            </p>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {PROBLEM_CARDS.map((card) => (
                <article key={card.title} className="nw-card">
                  <h3 className="text-xl font-semibold text-ink">{card.title}</h3>
                  <p className="mt-3 text-base text-muted">{card.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 3. How it works */}
        <section id="how" className="scroll-mt-24 border-b-2 border-ink bg-green-600 px-4 py-16 text-paper sm:px-6">
          <div className="mx-auto w-full max-w-[1200px]">
            <p className="nw-mono text-[12px] text-paper/80">How it works</p>
            <h2 className="nw-display mt-3 text-[clamp(32px,6vw,64px)] text-paper">
              Four steps. You stay <span className="text-blue">in charge.</span>
            </h2>
            <ol className="mt-12 grid gap-10 lg:grid-cols-2">
              {HOW_STEPS.map((step) => (
                <li key={step.n} className="grid gap-4 sm:grid-cols-[minmax(0,160px)_1fr] sm:items-start">
                  <PhoneFrame src={step.image} alt={step.alt} width={step.width} height={step.height} />
                  <div>
                    <p className="nw-mono inline-block border-2 border-ink bg-yellow px-2 py-1 text-[12px] text-ink">
                      {step.n}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-paper">{step.title}</h3>
                    <p className="mt-3 text-base text-paper/90">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 4. Features */}
        <section id="features" className="scroll-mt-24 border-b-2 border-ink bg-page px-4 py-16 sm:px-6">
          <div className="mx-auto w-full max-w-[1200px]">
            <SectionHeading before="Built for real" highlight="study" />
            <p className="mt-4 max-w-2xl text-lg text-muted">
              Only features that ship today are marked Live. Coming soon means it is not ready yet.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {LANDING_FEATURES.map((feature) => (
                <article key={feature.title} className="nw-card flex flex-col gap-3">
                  <StatusChip status={feature.status} />
                  <h3 className="text-xl font-semibold text-ink">{feature.title}</h3>
                  <p className="text-base text-muted">{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Live Tutor */}
        <LiveTutorSpotlight />

        {/* 6. Privacy */}
        <section className="border-b-2 border-ink bg-page px-4 py-16 sm:px-6">
          <div className="mx-auto w-full max-w-[1200px]">
            <SectionHeading before="Privacy and" highlight="safety" />
            <ul className="mt-8 grid max-w-3xl gap-3 text-base text-ink">
              <li className="border-2 border-ink bg-paper px-4 py-3 shadow-[4px_4px_0_var(--shadow)]">No account. No ads. No analytics tracking.</li>
              <li className="border-2 border-ink bg-paper px-4 py-3 shadow-[4px_4px_0_var(--shadow)]">Notes stay on your phone in IndexedDB until you choose otherwise.</li>
              <li className="border-2 border-ink bg-paper px-4 py-3 shadow-[4px_4px_0_var(--shadow)]">
                Cloud reading, Tutor, and quiz generation send only what that feature needs — and only when you use them.
              </li>
              <li className="border-2 border-ink bg-paper px-4 py-3 shadow-[4px_4px_0_var(--shadow)]">You review every page before it is used for search, Tutor, or practice.</li>
              <li className="border-2 border-ink bg-paper px-4 py-3 shadow-[4px_4px_0_var(--shadow)]">Delete all data anytime in Settings. Drive backup only touches files NoteWise created.</li>
            </ul>
            <div className="mt-8">
              <Button href="/privacy" variant="secondary">
                Read the privacy page
              </Button>
            </div>
          </div>
        </section>

        {/* 7. Honest limits */}
        <section className="border-b-2 border-ink bg-green-600 px-4 py-16 text-paper sm:px-6">
          <div className="mx-auto w-full max-w-[1200px]">
            <h2 className="nw-display text-[clamp(32px,6vw,64px)] text-paper">
              Honest <span className="text-blue">limits.</span>
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <article className="border-2 border-ink bg-green-800 p-5 shadow-[6px_6px_0_var(--shadow)]">
                <h3 className="text-xl font-semibold">Handwriting is hard</h3>
                <p className="mt-3 text-base text-paper/90">That is why you check and correct the text before it enters your library.</p>
              </article>
              <article className="border-2 border-ink bg-green-800 p-5 shadow-[6px_6px_0_var(--shadow)]">
                <h3 className="text-xl font-semibold">AI can be wrong</h3>
                <p className="mt-3 text-base text-paper/90">Tutor answers show their source and say when they are unsure.</p>
              </article>
              <article className="border-2 border-ink bg-green-800 p-5 shadow-[6px_6px_0_var(--shadow)]">
                <h3 className="text-xl font-semibold">Check with your teacher</h3>
                <p className="mt-3 text-base text-paper/90">Use NoteWise to revise — confirm important facts with a human teacher.</p>
              </article>
            </div>
          </div>
        </section>

        {/* 8. Audience */}
        <section className="border-b-2 border-ink bg-page px-4 py-16 sm:px-6">
          <div className="mx-auto w-full max-w-[1200px]">
            <SectionHeading before="Who it is" highlight="for" />
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {AUDIENCE.map((item) => (
                <article key={item.title} className="nw-card">
                  <StatusChip status={item.status} />
                  <h3 className="mt-3 text-xl font-semibold text-ink">{item.title}</h3>
                  <p className="mt-2 text-base text-muted">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 9. Install */}
        <section className="border-b-2 border-ink bg-green-600 px-4 py-16 text-paper sm:px-6">
          <div className="mx-auto w-full max-w-[1200px]">
            <h2 className="nw-display text-[clamp(32px,6vw,64px)] text-paper">
              Install on your <span className="text-blue">phone.</span>
            </h2>
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <article className="border-2 border-ink bg-green-800 p-5 shadow-[6px_6px_0_var(--shadow)]">
                <h3 className="nw-mono inline-block border-2 border-ink bg-yellow px-2 py-1 text-[12px] text-ink">
                  Android · Chrome
                </h3>
                <p className="mt-3 text-base">Menu → Add to Home screen / Install app. Or tap the install button when Chrome offers it.</p>
              </article>
              <article className="border-2 border-ink bg-green-800 p-5 shadow-[6px_6px_0_var(--shadow)]">
                <h3 className="nw-mono inline-block border-2 border-ink bg-yellow px-2 py-1 text-[12px] text-ink">
                  iPhone · Safari
                </h3>
                <p className="mt-3 text-base">Share → Add to Home Screen. Safari is required for a proper home-screen icon.</p>
              </article>
            </div>
            <InstallPromptButton />
          </div>
        </section>

        {/* 10. FAQ */}
        <section id="faq" className="scroll-mt-24 border-b-2 border-ink bg-page px-4 py-16 sm:px-6">
          <div className="mx-auto w-full max-w-[1200px]">
            <SectionHeading before="Questions," highlight="answered" />
            <FaqAccordion />
          </div>
        </section>

        {/* 11. About */}
        <section className="border-b-2 border-ink bg-green-600 px-4 py-16 text-paper sm:px-6">
          <div className="mx-auto w-full max-w-[1200px]">
            <h2 className="nw-display text-[clamp(32px,6vw,64px)] text-paper">
              About <span className="text-blue">{SITE_NAME}.</span>
            </h2>
            <p className="mt-6 max-w-3xl text-lg text-paper">Built by {CREATOR_NAME}.</p>
            <p className="mt-4 max-w-3xl text-base text-paper/90">
              Free and open-source tools power the app shell (Next.js, Dexie, Serwist, Tesseract.js, transformers.js,
              pdf-lib, docx, Framer Motion). Cloud handwriting and language models run through a free-tier adapter so
              providers can be swapped. The product decisions and review step stay with the student.
            </p>
            {LANDING_STATS.length > 0 ? (
              <dl className="mt-10 grid gap-4 sm:grid-cols-3">
                {LANDING_STATS.map((stat) => (
                  <div key={stat.label} className="border-2 border-ink bg-green-800 p-4 shadow-[4px_4px_0_var(--shadow)]">
                    <dt className="nw-mono text-[11px] text-paper/80">{stat.label}</dt>
                    <dd className="nw-display mt-2 text-4xl text-paper">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-ink bg-ink px-4 py-10 text-paper sm:px-6">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 sm:flex-row sm:justify-between">
          <div>
            <p className="font-mono text-sm font-bold tracking-[0.14em]">NOTEWISE AI</p>
            <p className="mt-2 max-w-md text-sm text-paper/80">
              Local-first study companion for handwritten notes. Built by {CREATOR_NAME}.
            </p>
          </div>
          <nav className="flex flex-col gap-3 sm:items-end" aria-label="Footer">
            <Link href="/privacy" className="nw-mono text-[12px] text-paper no-underline">
              Privacy
            </Link>
            <Link href="/guide" className="nw-mono text-[12px] text-paper no-underline">
              Guide
            </Link>
            <Link href="/about" className="nw-mono text-[12px] text-paper no-underline">
              About
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
