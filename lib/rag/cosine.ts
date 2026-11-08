/** 1 means the same direction. MiniLM vectors are normalised, so this matches their dot product. */
export function cosine(left: ArrayLike<number>, right: ArrayLike<number>) {
  if (left.length === 0 || left.length !== right.length) return 0;
  let dot = 0;
  let leftSize = 0;
  let rightSize = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    leftSize += a * a;
    rightSize += b * b;
  }
  if (leftSize === 0 || rightSize === 0) return 0;
  return dot / Math.sqrt(leftSize * rightSize);
}
