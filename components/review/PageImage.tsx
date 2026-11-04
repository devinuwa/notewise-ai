"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export function PageImage({ blob, label }: { blob: Blob; label: string }) {
  const url = useMemo(() => (blob.size ? URL.createObjectURL(blob) : ""), [blob]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  if (!url) {
    return (
      <div className="grid min-h-48 place-items-center border-2 border-ink bg-page px-4 text-center text-ink">
        This page has no photo.
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="block w-full border-2 border-ink bg-page p-2 text-left"
        onClick={() => setOpen(true)}
      >
        {/* Blob previews cannot use next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={label} className="mx-auto max-h-[70vh] w-full object-contain" />
        <span className="nw-mono mt-2 block text-center text-[12px] text-muted">Tap to enlarge</span>
      </button>
      {open ? <ZoomDialog url={url} label={label} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ZoomDialog({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [scale, setScale] = useState(1);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
  }, []);

  function distance() {
    const points = [...pointers.current.values()];
    if (points.length < 2) return 0;
    const [a, b] = points;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  return (
    <dialog
      ref={ref}
      className="nw-dialog max-h-[90vh]"
      style={{ width: "min(960px, calc(100% - 1rem))" }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="nw-mono text-[12px] text-muted">Pinch or use the buttons</p>
        <div className="flex gap-2">
          <button type="button" className="nw-btn nw-btn-secondary" onClick={() => setScale((value) => Math.max(1, value - 0.25))}>
            Smaller
          </button>
          <button type="button" className="nw-btn" onClick={() => setScale((value) => Math.min(4, value + 0.25))}>
            Larger
          </button>
          <button type="button" className="nw-btn nw-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div
        className="mt-4 max-h-[70vh] overflow-auto border-2 border-ink bg-page"
        style={{ touchAction: "none" }}
        onWheel={(event) => {
          setScale((value) => Math.min(4, Math.max(1, value + (event.deltaY < 0 ? 0.15 : -0.15))));
        }}
        onPointerDown={(event) => {
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          pinch.current = distance();
        }}
        onPointerMove={(event) => {
          if (!pointers.current.has(event.pointerId)) return;
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          const next = distance();
          if (pinch.current > 0 && next > 0) {
            const ratio = next / pinch.current;
            setScale((value) => Math.min(4, Math.max(1, value * ratio)));
            pinch.current = next;
          }
        }}
        onPointerUp={(event) => {
          pointers.current.delete(event.pointerId);
          pinch.current = distance();
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={label}
          className="mx-auto origin-top"
          style={{ width: `${scale * 100}%`, maxWidth: "none" }}
        />
      </div>
    </dialog>
  );
}
