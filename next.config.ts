import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

function readPackageVersion() {
  try {
    const raw = readFileSync(join(process.cwd(), "package.json"), "utf8");
    return (JSON.parse(raw) as { version?: string }).version ?? "0.1.0";
  } catch {
    return "0.1.0";
  }
}

function readGitCommit() {
  const fromEnv =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_GIT_COMMIT ||
    process.env.GIT_COMMIT;
  if (fromEnv) return fromEnv.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: ["10.195.227.248"],
  env: {
    NEXT_PUBLIC_APP_VERSION: readPackageVersion(),
    NEXT_PUBLIC_GIT_COMMIT: readGitCommit(),
  },
  turbopack: {
    resolveAlias: {
      // The package export map hides the browser build from the worker bundler.
      // Point at the web file, which does not load the Node ONNX runtime.
      "@huggingface/transformers": "./node_modules/@huggingface/transformers/dist/transformers.web.js",
      // pdfjs-dist mentions a Node canvas package. Exam PDFs are drawn in the browser.
      "@napi-rs/canvas": "./lib/exam/node-canvas-stub.ts",
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// @serwist/turbopack — documented Turbopack path for Next.js 16 (not webpack).
export default withSerwist(nextConfig);
