import Image from "next/image";

/**
 * Modern phone bezel (iPhone Pro–style): thin titanium rim, Dynamic Island,
 * and a soft inset screen — used for landing / guide screenshots.
 */
export function PhoneFrame({
  src,
  alt,
  width,
  height,
  priority = false,
  className = "",
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
}) {
  return (
    <figure className={`mx-auto w-full max-w-[260px] sm:max-w-[300px] ${className}`}>
      <div
        className="relative overflow-hidden rounded-[2.35rem] border-[5px] border-[#2a2a2c] bg-[#1c1c1e] p-[3px]"
        style={{
          boxShadow: "8px 8px 0 var(--shadow), inset 0 0 0 1px rgba(255,255,255,0.12)",
        }}
      >
        {/* Side buttons (visual only) */}
        <span aria-hidden className="absolute -left-[7px] top-[18%] h-8 w-[3px] rounded-l-sm bg-[#3a3a3c]" />
        <span aria-hidden className="absolute -left-[7px] top-[28%] h-14 w-[3px] rounded-l-sm bg-[#3a3a3c]" />
        <span aria-hidden className="absolute -left-[7px] top-[42%] h-14 w-[3px] rounded-l-sm bg-[#3a3a3c]" />
        <span aria-hidden className="absolute -right-[7px] top-[30%] h-20 w-[3px] rounded-r-sm bg-[#3a3a3c]" />

        <div className="relative overflow-hidden rounded-[1.95rem] bg-paper">
          {/* Dynamic Island */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-2 z-10 h-[22px] w-[92px] -translate-x-1/2 rounded-full bg-ink"
          >
            <span className="absolute right-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[#1a1a1c] ring-1 ring-[#2f2f32]" />
          </div>

          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            priority={priority}
            sizes="(max-width: 640px) 260px, 300px"
            className="h-auto w-full"
          />

          {/* Home indicator */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-1.5 flex justify-center">
            <span className="h-[4px] w-[34%] rounded-full bg-ink/80" />
          </div>
        </div>
      </div>
      <figcaption className="sr-only">{alt}</figcaption>
    </figure>
  );
}
