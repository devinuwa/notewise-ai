import Image from "next/image";

/**
 * iPhone Pro–style device frame for landing / guide shots.
 * Island sits in a real top bezel (not over the screenshot), so it stays visible
 * even when the capture includes the app’s green header.
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
    <figure className={`mx-auto w-full max-w-[270px] px-2 sm:max-w-[310px] ${className}`}>
      <div className="relative">
        {/* Hardware buttons outside the clipped shell */}
        <span aria-hidden className="absolute -left-1.5 top-[16%] z-20 h-7 w-[3px] rounded-sm bg-[#6b6b70]" />
        <span aria-hidden className="absolute -left-1.5 top-[24%] z-20 h-12 w-[3px] rounded-sm bg-[#6b6b70]" />
        <span aria-hidden className="absolute -left-1.5 top-[36%] z-20 h-12 w-[3px] rounded-sm bg-[#6b6b70]" />
        <span aria-hidden className="absolute -right-1.5 top-[28%] z-20 h-[4.5rem] w-[3px] rounded-sm bg-[#6b6b70]" />

        <div
          className="relative overflow-hidden rounded-[2.6rem] border-[6px] border-[#3a3a3c] bg-[#0b0b0c]"
          style={{
            boxShadow:
              "8px 8px 0 var(--shadow), 0 0 0 1px #111, inset 0 0 0 1px rgba(255,255,255,0.18)",
          }}
        >
          {/* Top bezel + Dynamic Island */}
          <div className="relative flex h-9 items-center justify-center bg-[#0b0b0c]">
            <div
              aria-hidden
              className="flex h-[22px] w-[96px] items-center justify-end rounded-full bg-black px-2.5"
              style={{ boxShadow: "inset 0 0 0 1px #222" }}
            >
              <span className="h-2 w-2 rounded-full bg-[#1c1c1e] ring-1 ring-[#3a3a3c]" />
            </div>
          </div>

          {/* Screen */}
          <div className="relative overflow-hidden bg-paper">
            <Image
              src={src}
              alt={alt}
              width={width}
              height={height}
              priority={priority}
              sizes="(max-width: 640px) 260px, 300px"
              className="h-auto w-full"
            />
          </div>

          {/* Bottom bezel + home indicator */}
          <div className="flex h-7 items-end justify-center bg-[#0b0b0c] pb-2">
            <span aria-hidden className="h-[4px] w-[36%] rounded-full bg-[#d1d1d6]" />
          </div>
        </div>
      </div>
      <figcaption className="sr-only">{alt}</figcaption>
    </figure>
  );
}
