/// <reference lib="esnext" />
/// <reference lib="webworker" />
import type { PrecacheEntry, RuntimeCaching } from "serwist";
import { CacheFirst, NetworkFirst, NetworkOnly, Serwist, StaleWhileRevalidate } from "serwist";

// Keep Serwist types on `self` only — do not widen WorkerGlobalScope globally.
declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
};

/**
 * Custom runtimeCaching (not defaultCache) so esbuild only bundles one
 * copy of Serwist's Strategy class — otherwise offline fallbacks break.
 */
const runtimeCaching: RuntimeCaching[] = [
  // Never cache OCR / tutor / quiz API responses — always hit the network.
  {
    matcher: ({ url }) => url.pathname.startsWith("/api/"),
    handler: new NetworkOnly(),
  },
  {
    // Embedding model + ONNX WASM from Hugging Face / jsDelivr.
    matcher: ({ url }) =>
      url.hostname.includes("huggingface.co") ||
      url.hostname.includes("hf.co") ||
      url.hostname.includes("jsdelivr.net") ||
      /\.(?:onnx|wasm)$/i.test(url.pathname),
    handler: new CacheFirst({ cacheName: "notewise-models" }),
  },
  {
    matcher: ({ request, url: { pathname } }) =>
      request.destination === "font" || pathname.startsWith("/fonts/") || /\.(?:woff2?|ttf|otf)$/i.test(pathname),
    handler: new CacheFirst({ cacheName: "notewise-fonts" }),
  },
  {
    matcher: ({ request, url: { pathname } }) =>
      request.destination === "image" ||
      pathname.startsWith("/icons/") ||
      pathname === "/og.png" ||
      /\.(?:png|jpg|jpeg|svg|webp|ico)$/i.test(pathname),
    handler: new CacheFirst({ cacheName: "notewise-icons" }),
  },
  {
    matcher: ({ request, url: { pathname } }) =>
      request.destination === "style" ||
      request.destination === "script" ||
      request.destination === "worker" ||
      pathname.startsWith("/_next/static/"),
    handler: new StaleWhileRevalidate({ cacheName: "notewise-static" }),
  },
  {
    // App shell documents (Home, Library, Settings, …).
    matcher: ({ request, sameOrigin, url: { pathname } }) =>
      sameOrigin && request.destination === "document" && !pathname.startsWith("/api/"),
    handler: new NetworkFirst({
      cacheName: "notewise-pages",
      networkTimeoutSeconds: 4,
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
