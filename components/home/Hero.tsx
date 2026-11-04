import { PixelLoader } from "@/components/ui/PixelLoader";
import { PixelStairs } from "@/components/ui/PixelStairs";
import { Reveal } from "@/components/motion/Reveal";

export function Hero({
  name,
  subtext,
  reduce,
}: {
  name: string;
  subtext: string;
  reduce: boolean;
}) {
  return (
    <section className="relative overflow-hidden bg-green-600 text-paper">
      <PixelStairs corner="tl" />
      <PixelStairs corner="tr" />
      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-4 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-44">
        <Reveal reduce={reduce} delay={0}>
          <PixelLoader still size={16} />
        </Reveal>
        <h1 className="nw-display mt-6 max-w-full text-[clamp(32px,10vw,112px)]">
          <Reveal as="span" reduce={reduce} delay={0.08} className="block text-paper">
            Hi {name},
          </Reveal>
          <Reveal as="span" reduce={reduce} delay={0.16} className="block text-blue">
            welcome to your NoteWise.
          </Reveal>
        </h1>
        {subtext ? (
          <Reveal reduce={reduce} delay={0.24}>
            <p className="mt-6 max-w-2xl text-lg text-paper">{subtext}</p>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}
