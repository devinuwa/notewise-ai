"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";

export function OcrConsentDialog({
  open,
  onContinue,
  onDeviceOnly,
}: {
  open: boolean;
  onContinue: () => void;
  onDeviceOnly: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="nw-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onDeviceOnly();
      }}
    >
      <h2 className="nw-display text-[clamp(32px,4vw,48px)] text-ink">Before cloud reading</h2>
      <p className="mt-3 text-base text-ink">
        To read handwriting, this photo is sent to an AI service (Google AI Studio). Free AI services may use
        submitted content to improve their products. Do not scan pages with phone numbers, addresses, or other
        private details. You can switch to On-device reading in Settings, which keeps photos on your phone but is
        less accurate.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <Button type="button" onClick={onContinue}>
          I understand, continue
        </Button>
        <Button type="button" variant="secondary" onClick={onDeviceOnly}>
          Use on-device only
        </Button>
      </div>
    </dialog>
  );
}
