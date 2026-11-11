"use client";

import { Button } from "@/components/ui/Button";
import { PixelStairs } from "@/components/ui/PixelStairs";

export default function ClearedPage() {
  // Full reload after wipe — soft nav can leave Dexie/live-query state half-open on /.
  function startFresh() {
    // Hard navigation is intentional here (not soft router.push).
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- reset IndexedDB listeners
    window.location.assign("/");
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-green-600 text-paper">
      <PixelStairs corner="tl" />
      <PixelStairs corner="tr" />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[1200px] flex-col justify-center px-4 py-20 sm:px-6">
        <p className="nw-mono text-[12px] text-paper">See you soon</p>
        <h1 className="nw-display mt-4 max-w-full text-[clamp(32px,10vw,112px)] text-paper">
          Your data is
          <span className="block text-blue">cleared.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-paper">
          Notes and your reading choice were removed from this device. A Google Drive backup, if you had
          one, was not touched.
        </p>
        <div className="mt-8">
          <Button type="button" onClick={startFresh}>
            Start fresh
          </Button>
        </div>
      </div>
    </main>
  );
}
