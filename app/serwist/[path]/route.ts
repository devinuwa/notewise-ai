import { createSerwistRoute } from "@serwist/turbopack";
import { cacheLife } from "next/cache";

/**
 * cacheComponents: true strips the segment configs Serwist needs for SSG.
 * Wrap the compile in "use cache" so /serwist/sw.js is still prerendered.
 * See Serwist Turbopack docs + Next 16 cacheComponents notes.
 */
const serwistRoute = createSerwistRoute({
  swSrc: "app/sw.ts",
  // Only routes — public icons/fonts are already hashed into the auto manifest.
  // Duplicate URLs with different revisions crash SW evaluation.
  additionalPrecacheEntries: [
    { url: "/", revision: "shell-v1" },
    { url: "/library", revision: "shell-v1" },
    { url: "/settings", revision: "shell-v1" },
    { url: "/practice", revision: "shell-v1" },
    { url: "/tutor", revision: "shell-v1" },
    { url: "/privacy", revision: "shell-v1" },
    { url: "/offline", revision: "shell-v1" },
    { url: "/scan", revision: "shell-v1" },
  ],
  useNativeEsbuild: true,
  esbuildOptions: {
    format: "iife",
    target: ["chrome90", "firefox90", "safari15"],
    minify: true,
  },
});

export const generateStaticParams = serwistRoute.generateStaticParams;

async function buildSerwistFile(path: string) {
  "use cache";
  cacheLife("max");
  const response = await serwistRoute.GET(new Request(`https://serwist.invalid/${path}`), {
    params: Promise.resolve({ path }),
  });
  return {
    body: await response.text(),
    contentType: response.headers.get("Content-Type") ?? "text/plain",
  };
}

export async function GET(_request: Request, context: { params: Promise<{ path: string }> }) {
  const { path } = await context.params;
  const { body, contentType } = await buildSerwistFile(path);
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Service-Worker-Allowed": "/",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
