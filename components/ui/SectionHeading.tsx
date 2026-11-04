export function SectionHeading({
  before,
  highlight,
}: {
  before: string;
  highlight: string;
}) {
  return (
    <h2 className="nw-display max-w-full text-[clamp(28px,8vw,64px)] text-ink">
      {before} <span className="text-red">{highlight}.</span>
    </h2>
  );
}
