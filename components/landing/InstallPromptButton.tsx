"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIos() {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

/** Triggers the browser install prompt when Chrome/Edge offers one. */
export function InstallPromptButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [message, setMessage] = useState("");
  const ios = useSyncExternalStore(
    () => () => {},
    () => isIos(),
    () => false,
  );
  const standalone = useSyncExternalStore(
    () => () => {},
    () => isStandalone(),
    () => false,
  );

  useEffect(() => {
    if (standalone || ios) return;
    function onPrompt(event: Event) {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, [standalone, ios]);

  if (standalone) {
    return <p className="mt-4 text-base text-paper">NoteWise is already installed on this device.</p>;
  }

  if (ios) {
    return (
      <p className="mt-4 max-w-xl text-base text-paper">
        On iPhone: open in Safari, tap Share, then <strong className="text-paper">Add to Home Screen</strong>.
      </p>
    );
  }

  return (
    <div className="mt-6">
      <Button
        type="button"
        disabled={!deferred}
        onClick={() => {
          void (async () => {
            if (!deferred) {
              setMessage("Open this page in Chrome on Android, then try again after the install prompt is ready.");
              return;
            }
            await deferred.prompt();
            await deferred.userChoice;
            setDeferred(null);
            setMessage("Install started. Check your home screen.");
          })();
        }}
      >
        {deferred ? "Install NoteWise" : "Install when available"}
      </Button>
      {message ? (
        <p className="mt-3 border-2 border-ink bg-paper px-3 py-2 text-sm text-ink" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
