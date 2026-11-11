/// <reference lib="esnext" />
/// <reference lib="webworker" />
import type { PrecacheEntry, RuntimeCaching } from "serwist";
import { CacheFirst, NetworkFirst, NetworkOnly, Serwist, StaleWhileRevalidate } from "serwist";

// Keep Serwist types on `self` only — do not widen WorkerGlobalScope globally.
declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
};

function entryUrl(entry: PrecacheEntry | string) {
  return typeof entry === "string" ? entry : entry.url;
}

/** Turbopack dedicated workers read bootstrap JSON from location.hash (#params=…). */
function isTurbopackWorkerUrl(pathname: string) {
  return pathname.includes("turbopack-worker");
}

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
    // Remote model hosts: never CacheFirst — a truncated HF/ORT response poisoned the study brain.
    // transformers.js keeps its own browser cache; same-origin tessdata WASM stays CacheFirst below.
    matcher: ({ url }) =>
      url.hostname.includes("huggingface.co") ||
      url.hostname.includes("hf.co") ||
      url.hostname.includes("jsdelivr.net"),
    handler: new NetworkOnly(),
  },
  {
    // Local OCR / PDF WASM assets shipped with the app.
    matcher: ({ sameOrigin, url }) => sameOrigin && /\.(?:onnx|wasm)$/i.test(url.pathname),
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
    // Skip destination=worker and turbopack-worker entrypoints entirely (no respondWith).
    // Any SW respondWith — even NetworkOnly — drops the #params= hash the worker needs,
    // which surfaces as "Missing worker bootstrap config" and kills the study brain.
    matcher: ({ request, url: { pathname } }) =>
      request.destination !== "worker" &&
      !isTurbopackWorkerUrl(pathname) &&
      (request.destination === "style" ||
        request.destination === "script" ||
        pathname.startsWith("/_next/static/")),
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
  // Precaching the worker entry also intercepts it and strips #params=.
  precacheEntries: (self.__SW_MANIFEST ?? []).filter((entry) => !isTurbopackWorkerUrl(entryUrl(entry))),
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
