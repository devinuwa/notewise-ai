/** Trim the name and capitalise the first letter of each word. */
export function titleCaseName(input: string) {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
