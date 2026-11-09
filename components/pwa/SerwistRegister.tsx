"use client";

import { SerwistProvider } from "@serwist/turbopack/react";
import type { ReactNode } from "react";
import { UpdateBanner } from "@/components/pwa/UpdateBanner";

/** Registers /serwist/sw.js. Disabled in `next dev` so HMR stays predictable. */
export function SerwistRegister({ children }: { children: ReactNode }) {
  const disable = process.env.NODE_ENV === "development";

  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      cacheOnNavigation={false}
      // Never force-reload on reconnect — that can wipe in-progress edits.
      reloadOnOnline={false}
      disable={disable}
    >
      {children}
      {disable ? null : <UpdateBanner />}
    </SerwistProvider>
  );
}
