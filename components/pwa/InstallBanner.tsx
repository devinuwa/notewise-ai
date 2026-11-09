"use client";

import { useEffect, useState } from "react";
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

export function InstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // Private mode may block sessionStorage.
    }

    if (isIos()) {
      setIosHint(true);
      setHidden(false);
      return;
    }

    function onPrompt(event: Event) {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setHidden(false);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setHidden(true);
    setDeferred(null);
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

  if (hidden) return null;

  return (
    <aside
      className="relative z-40 border-b-2 border-ink bg-paper px-4 py-3 text-ink shadow-[0_4px_0_var(--shadow)]"
      aria-label="Install NoteWise"
    >
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="nw-mono text-[12px] text-muted">Home screen</p>
          <p className="mt-1 text-base">
            {iosHint
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
