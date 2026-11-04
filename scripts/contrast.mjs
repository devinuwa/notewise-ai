function channel(hex) {
  const value = parseInt(hex, 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const raw = hex.replace("#", "");
  const r = channel(raw.slice(0, 2));
  const g = channel(raw.slice(2, 4));
  const b = channel(raw.slice(4, 6));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const lighter = Math.max(luminance(a), luminance(b));
  const darker = Math.min(luminance(a), luminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

const pairs = [
  ["paper on forest", "#f2f2eb", "#3d5f58", 4.5],
  ["sky headline on forest", "#8bb2de", "#3d5f58", 3],
  ["ink on salmon", "#231f20", "#e97b77", 4.5],
  ["ink on ochre", "#231f20", "#f5b726", 4.5],
  ["ink on sky", "#231f20", "#8bb2de", 4.5],
  ["ink on idle chip", "#231f20", "#d9d6cc", 4.5],
  ["paper on deep forest", "#f2f2eb", "#2e4742", 4.5],
  ["muted on paper", "#3e4744", "#f2f2eb", 4.5],
  ["muted on page", "#3e4744", "#e4e3d8", 4.5],
  ["ink on paper", "#231f20", "#f2f2eb", 4.5],
  ["ink on page", "#231f20", "#e4e3d8", 4.5],
  ["white on forest chip", "#f2f2eb", "#3d5f58", 4.5],
  ["red word on paper", "#e53927", "#f2f2eb", 3],
];

let failed = 0;
for (const [name, fg, bg, min] of pairs) {
  const ratio = contrast(fg, bg);
  const ok = ratio >= min;
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${ratio.toFixed(2)}:1 (need ${min}) ${name}`);
}
if (failed) process.exit(1);
