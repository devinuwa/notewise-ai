"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { PixelLoader } from "@/components/ui/PixelLoader";
import { backupToDrive } from "@/lib/drive/backup";
import { driveConfigured, friendlyDriveError } from "@/lib/drive/errors";
import { disconnectDrive, ensureDriveToken, getDriveToken, subscribeDriveToken } from "@/lib/drive/gis";
import { assertRestoreChoice, listDriveBackups, restoreFromDrive } from "@/lib/drive/restore";
import type { DriveFile, RestoreMode } from "@/lib/drive/types";
import { OFFLINE_DRIVE, onlineServerSnapshot, onlineSnapshot, subscribeOnline } from "@/lib/offline";

function tokenSnapshot() {
  return getDriveToken() !== null;
}

export function DrivePanel({ compact = false }: { compact?: boolean }) {
  const connected = useSyncExternalStore(subscribeDriveToken, tokenSnapshot, () => false);
  const online = useSyncExternalStore(subscribeOnline, onlineSnapshot, onlineServerSnapshot);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [includePhotos, setIncludePhotos] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [fileId, setFileId] = useState("");
  const [mode, setMode] = useState<RestoreMode | "">("");
  const configured = driveConfigured();
  // Hide restore UI when the token is gone — do not mirror connected into state via useEffect.
  const restoreVisible = connected && restoreOpen;

  async function onConnect() {
    setError("");
    setMessage("");
    if (!online) {
      setError(OFFLINE_DRIVE);
      return;
    }
    // Prefer a quiet reconnect when Google already remembers this app (no full consent UI).
    setBusy("Connecting to Google Drive… Leave any Google window open until it closes itself.");
    try {
      await ensureDriveToken();
      setMessage("Google Drive is connected on this device until you leave or disconnect.");
    } catch (caught) {
      setError(friendlyDriveError(caught));
    } finally {
      setBusy("");
    }
  }

  async function onBackup() {
    setError("");
    setMessage("");
    if (!online) {
      setError(OFFLINE_DRIVE);
      return;
    }
    setBusy("Backing up…");
    try {
      const result = await backupToDrive(includePhotos, (progress) => setBusy(progress.caption));
      setMessage(
        includePhotos
          ? `Backed up to Google Drive, including ${result.photos} photo${result.photos === 1 ? "" : "s"}.`
          : "Backed up to Google Drive. Photos stayed on this device.",
      );
    } catch (caught) {
      setError(friendlyDriveError(caught));
    } finally {
      setBusy("");
    }
  }

  async function onDisconnect() {
    setError("");
    setMessage("");
    setBusy("Disconnecting…");
    try {
      await disconnectDrive();
      setMessage("Google Drive was disconnected on this device.");
    } catch (caught) {
      setError(friendlyDriveError(caught));
    } finally {
      setBusy("");
    }
  }

  async function openRestore() {
    setError("");
    setMessage("");
    if (!online) {
      setError(OFFLINE_DRIVE);
      return;
    }
    setBusy("Looking for backups…");
    try {
      const listed = await listDriveBackups();
      setFiles(listed.files);
      setFileId(listed.files[0]?.id ?? "");
      setMode("");
      setRestoreOpen(true);
      if (listed.files.length === 0) {
        setError("No NoteWise backup was found on Google Drive yet. Back up first.");
      }
    } catch (caught) {
      setError(friendlyDriveError(caught));
    } finally {
      setBusy("");
    }
  }

  async function onRestore() {
    setError("");
    setMessage("");
    try {
      assertRestoreChoice(mode);
      if (!fileId) throw new Error("Pick a backup file first.");
      setBusy("Restoring…");
      const result = await restoreFromDrive(fileId, mode, (caption) => setBusy(caption));
      setRestoreOpen(false);
      setMessage(
        mode === "replace"
          ? `Replaced this device with ${result.pages} page${result.pages === 1 ? "" : "s"} from Drive.`
          : `Merged ${result.pages} page${result.pages === 1 ? "" : "s"} from Drive. Newer local edits were kept.`,
      );
    } catch (caught) {
      setError(friendlyDriveError(caught));
    } finally {
      setBusy("");
    }
  }

  if (!configured) {
    return (
      <section className={compact ? "" : "mt-8"}>
        {!compact ? <p className="nw-mono text-[12px] text-muted">Google Drive</p> : null}
        <p className={`${compact ? "" : "mt-2"} max-w-xl text-base text-ink`}>
          Google Drive is not set up on this computer yet. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID. See the README.
        </p>
      </section>
    );
  }

  return (
    <section className={compact ? "flex w-full min-w-0 flex-col gap-3" : "mt-8"}>
      {!compact ? (
        <>
          <p className="nw-mono text-[12px] text-muted">Google Drive</p>
          <p className="mt-2 max-w-xl text-base text-ink">
            Backup uses only files NoteWise creates. The sign-in token stays in memory on this device and is not saved.
          </p>
        </>
      ) : null}

      {!online && !busy ? (
        <p className={`${compact ? "" : "mt-4"} border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink`} role="status">
          {OFFLINE_DRIVE}
        </p>
      ) : null}

      {busy ? (
        <div className={compact ? "" : "mt-4"}>
          <PixelLoader caption={busy} tone="on-paper" />
        </div>
      ) : (
        <div className={`flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap ${compact ? "" : "mt-4"}`}>
          {!connected ? (
            <Button type="button" className="w-full sm:w-auto" disabled={!online} onClick={() => void onConnect()}>
              Connect Google Drive
            </Button>
          ) : (
            <>
              <Button type="button" className="w-full sm:w-auto" disabled={!online} onClick={() => void onBackup()}>
                Back up now
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={!online}
                onClick={() => void openRestore()}
              >
                Restore from Drive
              </Button>
              <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => void onDisconnect()}>
                Disconnect Drive
              </Button>
            </>
          )}
        </div>
      )}

      {connected && !busy ? (
        <label className={`flex items-start gap-3 text-sm text-ink ${compact ? "" : "mt-4"}`}>
          <input
            type="checkbox"
            className="mt-1 size-5 border-2 border-ink accent-ink"
            checked={includePhotos}
            onChange={(event) => setIncludePhotos(event.target.checked)}
          />
          <span>
            Include photos
            <span className="mt-1 block text-muted">Left unticked, only text and metadata go to Drive.</span>
          </span>
        </label>
      ) : null}

      {restoreVisible ? (
        <div className="mt-4 border-2 border-ink bg-paper px-4 py-4 text-ink shadow-[4px_4px_0_var(--shadow)]">
          <p className="nw-mono text-[12px] text-muted">Restore</p>
          <p className="mt-2 text-base">
            Merge keeps newer edits on this device. Replace clears subjects, topics, pages, quizzes, tutor chat, and
            exam backups first.
          </p>
          <label className="mt-4 block">
            <span className="nw-mono text-[12px] text-muted">Backup file</span>
            <select className="nw-input mt-2 w-full" value={fileId} onChange={(event) => setFileId(event.target.value)}>
              {files.length === 0 ? <option value="">No backup found</option> : null}
              {files.map((file) => (
                <option key={file.id} value={file.id}>
                  {file.name}
                  {file.modifiedTime ? ` · ${new Date(file.modifiedTime).toLocaleString()}` : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row" role="group" aria-label="Restore mode">
            <Button
              type="button"
              variant={mode === "merge" ? "primary" : "secondary"}
              className="w-full sm:w-auto"
              aria-pressed={mode === "merge"}
              onClick={() => setMode("merge")}
            >
              Merge
            </Button>
            <Button
              type="button"
              variant={mode === "replace" ? "primary" : "secondary"}
              className="w-full sm:w-auto"
              aria-pressed={mode === "replace"}
              onClick={() => setMode("replace")}
            >
              Replace
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" disabled={!fileId || !mode || Boolean(busy)} onClick={() => void onRestore()}>
              Restore
            </Button>
            <Button type="button" variant="secondary" onClick={() => setRestoreOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className={`${compact ? "" : "mt-4"} border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink`} role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className={`${compact ? "" : "mt-4"} text-base text-ink`}>{message}</p> : null}
    </section>
  );
}
