"use client";

import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Button } from "@/components/ui/Button";
import { PixelLoader } from "@/components/ui/PixelLoader";
import { preparePageImage, type PreparedPage } from "@/lib/scan/prepare-image";

export function CropEditor({
  sourceUrl,
  onCancel,
  onConfirm,
}: {
  sourceUrl: string;
  onCancel: () => void;
  onConfirm: (prepared: PreparedPage) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState(3 / 4);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    if (!pixels) {
      setError("Wait for the page to appear, then crop it.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      onConfirm(await preparePageImage(sourceUrl, pixels, rotation));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The page could not be cropped.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-page text-ink">
      <div className="flex items-center justify-between gap-3 border-b-2 border-ink px-4 py-3">
        <p className="nw-mono text-[12px]">Crop this page</p>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
      <div className="relative min-h-0 flex-1 bg-ink">
        {busy ? (
          <div className="grid h-full place-items-center">
            <PixelLoader caption="Cleaning this page…" />
          </div>
        ) : (
          <Cropper
            image={sourceUrl}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            cropShape="rect"
            showGrid
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={(_area, croppedPixels) => setPixels(croppedPixels)}
          />
        )}
      </div>
      <div className="flex flex-col gap-3 border-t-2 border-ink px-4 py-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setRotation((value) => value - 90)} disabled={busy}>
            Rotate left
          </Button>
          <Button type="button" variant="secondary" onClick={() => setRotation((value) => value + 90)} disabled={busy}>
            Rotate right
          </Button>
          <Button type="button" variant="secondary" onClick={() => setAspect(3 / 4)} disabled={busy} aria-pressed={aspect === 3 / 4}>
            Portrait
          </Button>
          <Button type="button" variant="secondary" onClick={() => setAspect(4 / 3)} disabled={busy} aria-pressed={aspect === 4 / 3}>
            Landscape
          </Button>
        </div>
        <label className="nw-mono text-[12px] text-muted" htmlFor="crop-zoom">
          Zoom
        </label>
        <input
          id="crop-zoom"
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
          disabled={busy}
        />
        {error ? (
          <p className="border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="button" className="w-full" onClick={confirm} disabled={busy}>
          Use this crop
        </Button>
      </div>
    </div>
  );
}
