"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { appVersionLabel } from "@/lib/app-version";
import { checkForServiceWorkerUpdate } from "@/lib/pwa/updates";

export function AboutSettings() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onCheck() {
    setBusy(true);
    setMessage("");
    const result = await checkForServiceWorkerUpdate();
    setBusy(false);
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    setMessage("Checked for updates. If a new version is ready, a banner appears at the bottom.");
  }

  return (
    <section className="mt-8">
      <p className="nw-mono text-[12px] text-muted">About</p>
      <p className="mt-2 max-w-xl text-base text-ink">
        App version: <span className="nw-mono text-[12px] normal-case tracking-normal">{appVersionLabel()}</span>
      </p>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Use this number when checking which build a phone is running after an install or update.
      </p>
      <div className="mt-4">
        <Button type="button" variant="secondary" className="w-full sm:w-auto" disabled={busy} onClick={() => void onCheck()}>
          {busy ? "Checking…" : "Check for updates"}
        </Button>
      </div>
      {message ? (
        <p className="mt-3 border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
