"use client";

import { useEffect, useRef, useState } from "react";
import { useSerwist } from "@serwist/turbopack/react";
import { Button } from "@/components/ui/Button";
import { isReloadBlocked, subscribeSessionBusy } from "@/lib/pwa/session-busy";
import { reloadToApplyUpdate } from "@/lib/pwa/updates";

const IDLE_MS = 10_000;

/**
 * Shows when a new service worker is ready. Reloads on demand, or after 10s
 * of inactivity when no edit / OCR / quiz is in progress.
 */
export function UpdateBanner() {
  const { serwist } = useSerwist();
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const idleTimer = useRef<number | null>(null);
  const lastActivity = useRef(0);
  const reloading = useRef(false);

  useEffect(() => {
    lastActivity.current = Date.now();
    return subscribeSessionBusy(() => {
      void isReloadBlocked().then(setBlocked);
    });
  }, []);

  useEffect(() => {
    if (!serwist || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const markReady = () => setReady(true);

    const watchInstalling = (worker: ServiceWorker | null | undefined) => {
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (
          (worker.state === "installed" || worker.state === "activated") &&
          navigator.serviceWorker.controller
        ) {
          markReady();
        }
      });
    };

    void navigator.serviceWorker.getRegistration().then((registration) => {
      if (!registration) return;
      // Check for updates on every open.
      void registration.update();
      if (registration.waiting && navigator.serviceWorker.controller) markReady();
      watchInstalling(registration.installing);
      registration.addEventListener("updatefound", () => {
        watchInstalling(registration.installing);
      });
    });

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void navigator.serviceWorker.getRegistration().then((registration) => {
        void registration?.update();
      });
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    serwist.addEventListener("installed", (event) => {
      if (event.isUpdate) markReady();
    });
    serwist.addEventListener("waiting", markReady);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [serwist]);

  useEffect(() => {
    if (!ready) return;

    const bump = () => {
      lastActivity.current = Date.now();
    };
    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchstart", "scroll", "mousemove"];
    events.forEach((name) => window.addEventListener(name, bump, { passive: true }));

    idleTimer.current = window.setInterval(() => {
      void (async () => {
        if (reloading.current || !ready) return;
        if (Date.now() - lastActivity.current < IDLE_MS) return;
        if (await isReloadBlocked()) {
          setBlocked(true);
          return;
        }
        setBlocked(false);
        reloading.current = true;
        reloadToApplyUpdate();
      })();
    }, 1000);

    return () => {
      events.forEach((name) => window.removeEventListener(name, bump));
      if (idleTimer.current) window.clearInterval(idleTimer.current);
    };
  }, [ready]);

  if (!ready) return null;

  return (
    <aside
      className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-ink bg-paper px-4 py-3 text-ink shadow-[0_-4px_0_var(--shadow)]"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="nw-mono text-[12px] text-muted">Update</p>
          <p className="mt-1 text-base">
            A new version is ready{blocked ? " — finish editing first." : "."}
          </p>
        </div>
        <Button
          type="button"
          className="w-full sm:w-auto"
          disabled={blocked}
          onClick={() => {
            void (async () => {
              if (await isReloadBlocked()) {
                setBlocked(true);
                return;
              }
              reloading.current = true;
              serwist?.messageSkipWaiting();
              reloadToApplyUpdate();
            })();
          }}
        >
          Reload
        </Button>
      </div>
    </aside>
  );
}
