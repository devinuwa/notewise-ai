"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";

export function ClearDataDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
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
        onCancel();
      }}
    >
      <h2 className="nw-display text-[clamp(32px,4vw,48px)] text-ink">Clear my data?</h2>
      <p className="mt-3 text-base text-ink">
        This removes notes and your reading choice from this device. Drive backups are not touched.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Keep my notes
        </Button>
        <Button type="button" onClick={onConfirm}>
          Clear my data
        </Button>
      </div>
    </dialog>
  );
}
