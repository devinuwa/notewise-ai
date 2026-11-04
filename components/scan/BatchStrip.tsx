import { ChevronLeft, ChevronRight, Crop, RotateCcw, Trash2 } from "lucide-react";
import { PAGE_LIMIT, type DraftPage } from "@/components/scan/types";

export function BatchStrip({
  pages,
  onMove,
  onDelete,
  onCrop,
  onRetake,
}: {
  pages: DraftPage[];
  onMove: (index: number, direction: -1 | 1) => void;
  onDelete: (id: string) => void;
  onCrop: (id: string) => void;
  onRetake: (id: string) => void;
}) {
  if (pages.length === 0) {
    return <p className="text-base text-ink">No pages yet. Take a photo to start this batch.</p>;
  }

  return (
    <div>
      <p className="nw-mono text-[12px] text-muted">
        {pages.length} of {PAGE_LIMIT} pages
      </p>
      <ul className="mt-3 flex max-w-full gap-3 overflow-x-auto pb-2">
        {pages.map((page, index) => (
          <li key={page.id} className="w-40 shrink-0 border-2 border-ink bg-paper p-2">
            {/* Local blob previews cannot use the Next image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={page.previewUrl} alt={`Page ${index + 1} in this batch`} className="h-28 w-full border-2 border-ink object-cover" />
            <p className="nw-mono mt-2 text-[11px] text-ink">Page {index + 1}</p>
            <div className="mt-2 grid grid-cols-2 gap-1">
              <button type="button" className="nw-btn nw-btn-secondary px-1" onClick={() => onMove(index, -1)} disabled={index === 0} aria-label={`Move page ${index + 1} left`}>
                <ChevronLeft aria-hidden size={14} />
              </button>
              <button
                type="button"
                className="nw-btn nw-btn-secondary px-1"
                onClick={() => onMove(index, 1)}
                disabled={index === pages.length - 1}
                aria-label={`Move page ${index + 1} right`}
              >
                <ChevronRight aria-hidden size={14} />
              </button>
              <button type="button" className="nw-btn nw-btn-secondary px-1" onClick={() => onCrop(page.id)} aria-label={`Crop page ${index + 1}`}>
                <Crop aria-hidden size={14} />
                Crop
              </button>
              <button type="button" className="nw-btn nw-btn-secondary px-1" onClick={() => onRetake(page.id)} aria-label={`Retake page ${index + 1}`}>
                <RotateCcw aria-hidden size={14} />
                Retake
              </button>
              <button type="button" className="nw-btn nw-btn-secondary col-span-2 px-1" onClick={() => onDelete(page.id)} aria-label={`Delete page ${index + 1}`}>
                <Trash2 aria-hidden size={14} />
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
