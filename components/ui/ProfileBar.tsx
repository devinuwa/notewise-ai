import { DrivePanel } from "@/components/drive/DrivePanel";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function ProfileBar({
  name,
  onExport,
  onClear,
  exportError,
}: {
  name: string;
  onExport: () => void;
  onClear: () => void;
  exportError?: string;
}) {
  return (
    <Card className="flex min-w-0 flex-col gap-5">
      <div className="flex min-w-0 flex-col gap-5 md:flex-row md:flex-wrap md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={name} />
          <div className="min-w-0">
            <p className="nw-display text-[clamp(24px,6vw,40px)] text-ink">{name}</p>
            <p className="nw-mono mt-1 text-[12px] text-muted">Stored on this device</p>
          </div>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button href="/settings" variant="secondary" className="w-full sm:w-auto">
            Settings
          </Button>
          <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={onExport}>
            Export all data
          </Button>
          <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={onClear}>
            Clear my data
          </Button>
        </div>
      </div>
      <DrivePanel compact />
      {exportError ? (
        <p className="border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink" role="alert">
          {exportError}
        </p>
      ) : null}
    </Card>
  );
}
