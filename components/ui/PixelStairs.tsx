type Cell = "paper" | "red" | "empty";

const STAIR: Cell[][] = [
  ["empty", "paper", "paper", "empty", "empty", "red"],
  ["empty", "empty", "paper", "paper", "empty", "red"],
  ["empty", "empty", "empty", "paper", "paper", "red"],
  ["empty", "empty", "empty", "empty", "paper", "empty"],
];

function mirror(rows: Cell[][]) {
  return rows.map((row) => [...row].reverse());
}

export function PixelStairs({ corner }: { corner: "tl" | "tr" }) {
  const cells = (corner === "tr" ? mirror(STAIR) : STAIR).flat();
  return (
    <div aria-hidden className={`pixel-stairs pixel-stairs-${corner}`}>
      {cells.map((cell, index) => (
        <i key={`${corner}-${index}`} data-cell={cell} />
      ))}
    </div>
  );
}
