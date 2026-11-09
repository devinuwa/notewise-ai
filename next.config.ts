import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: ["10.195.227.248"],
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

export default nextConfig;