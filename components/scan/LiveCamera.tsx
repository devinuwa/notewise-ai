"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { frameToJpeg } from "@/lib/scan/prepare-image";

function denied(error: unknown) {
  if (!(error instanceof DOMException)) return false;
  return error.name === "NotAllowedError" || error.name === "PermissionDeniedError" || error.name === "SecurityError";
}

export function LiveCamera({
  onClose,
  onCapture,
  onUnavailable,
}: {
  onClose: () => void;
  onCapture: (blob: Blob) => void;
  onUnavailable: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const unavailableRef = useRef(onUnavailable);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    unavailableRef.current = onUnavailable;
  });

  useEffect(() => {
    const video = videoRef.current;
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });
      } catch (caught) {
        if (cancelled) return;
        unavailableRef.current(
          denied(caught)
            ? "The camera stayed off. Use Take photo or Choose from gallery."
            : "The live camera is not available. Use Take photo or Choose from gallery.",
        );
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      if (!cancelled) setReady(true);
    }

    void start();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function shutter() {
    const video = videoRef.current;
    if (!video) return;
    setError("");
    try {
      onCapture(await frameToJpeg(video));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The photo could not be taken.");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-ink text-paper">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="nw-mono text-[12px]">Live camera</p>
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="relative min-h-0 flex-1">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
        <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 pb-24">
          <div className="relative aspect-[3/4] h-[min(68vh,640px)] max-w-full border-2 border-paper">
            <span className="absolute left-0 top-0 h-5 w-5 border-l-4 border-t-4 border-salmon" />
            <span className="absolute right-0 top-0 h-5 w-5 border-r-4 border-t-4 border-salmon" />
            <span className="absolute bottom-0 left-0 h-5 w-5 border-b-4 border-l-4 border-salmon" />
            <span className="absolute bottom-0 right-0 h-5 w-5 border-b-4 border-r-4 border-salmon" />
          </div>
        </div>
      </div>
      <div className="px-4 pb-6 pt-3">
        <p className="text-center text-sm text-paper">Line the page up inside the frame. You can crop it on the next step.</p>
        {error ? (
          <p className="mt-3 border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex justify-center">
          <Button type="button" className="min-h-16 min-w-40" onClick={shutter} disabled={!ready}>
            Shutter
          </Button>
        </div>
      </div>
    </div>
  );
}
