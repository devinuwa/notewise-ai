"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { PixelStairs } from "@/components/ui/PixelStairs";

export function Onboarding({ onSave }: { onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 1) {
      setError("Type the name you want on this device.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(trimmed);
    } catch {
      setError("Could not save your name on this device.");
      setSaving(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-green-600 text-paper">
      <PixelStairs corner="tl" />
      <PixelStairs corner="tr" />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[720px] flex-col justify-center px-4 py-16 sm:px-6">
        <p className="nw-mono text-[12px] text-paper">First launch</p>
        <h1 className="nw-display mt-3 max-w-full text-[clamp(32px,10vw,96px)] text-paper">
          What should we call you?
        </h1>
        <p className="mt-4 max-w-xl text-lg text-paper">
          Your name stays on this device. We do not create an account.
        </p>
        <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
          <label className="nw-mono text-[12px] text-paper" htmlFor="display-name">
            Your name
          </label>
          <input
            id="display-name"
            className="nw-input"
            value={name}
            maxLength={40}
            autoComplete="nickname"
            onChange={(event) => setName(event.target.value)}
          />
          {error ? (
            <p className="border-2 border-ink bg-paper px-3 py-2 text-sm text-ink" role="alert">
              {error}
            </p>
          ) : null}
          <div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving" : "Continue"}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
