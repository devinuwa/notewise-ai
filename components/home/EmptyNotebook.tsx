import { Button } from "@/components/ui/Button";
import { PixelLoader } from "@/components/ui/PixelLoader";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";

export function EmptyNotebook({ reduce }: { reduce: boolean }) {
  return (
    <section className="mx-auto w-full max-w-[1200px] px-4 py-12 sm:px-6">
      <Reveal reduce={reduce} delay={0.32}>
        <PixelLoader still tone="on-paper" />
        <div className="mt-6">
          <SectionHeading before="Your notebook starts" highlight="here" />
        </div>
        <p className="mt-4 max-w-xl text-lg text-ink">
          Scan a handwritten page and the photo is stored on this device. Cloud reading, if you
          agree to it, sends that photo to Google AI Studio.
        </p>
        <div className="mt-6">
          <Button href="/scan">Scan your first page</Button>
        </div>
      </Reveal>
    </section>
  );
}
