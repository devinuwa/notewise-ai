import Image from "next/image";

/** CSS phone bezel for landing / guide screenshots. */
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
    <figure
      className={`mx-auto w-full max-w-[280px] overflow-hidden rounded-[28px] border-[3px] border-ink bg-ink p-2 shadow-[8px_8px_0_var(--shadow)] sm:max-w-[320px] ${className}`}
    >
      <div className="overflow-hidden rounded-[20px] border-2 border-ink bg-paper">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          sizes="(max-width: 640px) 280px, 320px"
          className="h-auto w-full"
        />
      </div>
      <figcaption className="sr-only">{alt}</figcaption>
    </figure>
  );
}
