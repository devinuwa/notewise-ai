/** Canonical public origin for metadata, sitemap, and Open Graph. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://notewise-ai-lovat.vercel.app"
).replace(/\/$/, "");

export const SITE_NAME = "NoteWise AI";
export const SITE_TAGLINE =
  "Photograph your handwritten notes. Search, listen, ask, and practise — free, with no account.";
