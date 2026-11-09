"use client";

import { useSyncExternalStore } from "react";
import { onlineServerSnapshot, onlineSnapshot, subscribeOnline } from "@/lib/offline";

export function OfflineChip() {
  const online = useSyncExternalStore(subscribeOnline, onlineSnapshot, onlineServerSnapshot);
  if (online) return null;
  return (
    <span className="nw-chip bg-yellow text-ink" role="status" aria-live="polite">
      Offline
    </span>
  );
}
