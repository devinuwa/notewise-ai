import type { CSSProperties } from "react";

export function PixelLoader({
  caption,
  still = false,
  size = 36,
  tone = "on-green",
}: {
  caption?: string;
  still?: boolean;
  size?: number;
  tone?: "on-green" | "on-paper";
}) {
  return (
    <div
      className={`pixel-loader${still ? " is-static" : ""}${tone === "on-paper" ? " on-paper" : ""}`}
      role={caption ? "status" : undefined}
    >
      <div
        className={still ? "pixel-loader-row is-static" : "pixel-loader-row"}
        style={{ "--block": `${size}px` } as CSSProperties}
      >
        <i />
        <i />
        <i />
        <i />
      </div>
      {caption ? <p className="pixel-loader-caption">{caption}</p> : null}
    </div>
  );
}
