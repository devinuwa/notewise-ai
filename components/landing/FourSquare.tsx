/** Static four-square motif from the NoteWise wordmark. */
export function FourSquare({ size = 14 }: { size?: number }) {
  const cell = Math.max(8, Math.floor(size / 2));
  return (
    <span aria-hidden className="inline-grid grid-cols-2 gap-px" style={{ width: size, height: size }}>
      <i className="block bg-paper" style={{ width: cell, height: cell }} />
      <i className="block bg-red" style={{ width: cell, height: cell }} />
      <i className="block bg-yellow" style={{ width: cell, height: cell }} />
      <i className="block bg-blue" style={{ width: cell, height: cell }} />
    </span>
  );
}
