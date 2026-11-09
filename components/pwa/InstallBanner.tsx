"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "notewise-install-dismissed";

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

function dismissedSnapshot() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeDismissed(listener: () => void) {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

export function InstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissTick, setDismissTick] = useState(0);
  const dismissed = useSyncExternalStore(subscribeDismissed, () => dismissedSnapshot() || dismissTick > 0, () => true);
  const standalone = useSyncExternalStore(
    () => () => {},
    () => isStandalone(),
    () => true,
  );
  const ios = useSyncExternalStore(
    () => () => {},
    () => isIos(),
    () => false,
  );

  useEffect(() => {
    if (standalone || dismissed || ios) return;

    function onPrompt(event: Event) {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, [standalone, dismissed, ios]);

  function dismiss() {
    setDeferred(null);
    setDismissTick((tick) => tick + 1);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  }

  const showIos = !standalone && !dismissed && ios;
  const showPrompt = !standalone && !dismissed && Boolean(deferred);
  if (!showIos && !showPrompt) return null;

  return (
    <aside
      className="relative z-40 border-b-2 border-ink bg-paper px-4 py-3 text-ink shadow-[0_4px_0_var(--shadow)]"
      aria-label="Install NoteWise"
    >
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="nw-mono text-[12px] text-muted">Home screen</p>
          <p className="mt-1 text-base">
            {showIos
              ? "Add NoteWise to your home screen: tap Share, then Add to Home Screen."
              : "Add NoteWise to your home screen for a full-screen, offline-friendly study app."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {deferred ? (
            <Button type="button" onClick={() => void install()}>
              Add NoteWise to your home screen
            </Button>
          ) : null}
          <Button type="button" variant="secondary" onClick={dismiss}>
            Not now
          </Button>
        </div>
      </div>
    </aside>
  );
}
