"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

function available() {
  return window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === "function";
}

/** Live camera needs HTTPS or localhost. A phone on plain HTTP keeps the file buttons. */
export function useLiveCameraAvailable() {
  return useSyncExternalStore(subscribe, available, () => false);
}
