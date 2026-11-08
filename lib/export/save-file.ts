export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function openFile(file: File) {
  const url = URL.createObjectURL(file);
  const opened = window.open(url, "_blank", "noopener");
  if (!opened) downloadFile(file);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Share the file when the phone allows it. Otherwise save it as a download. */
export async function shareOrDownload(file: File) {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return;
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
    }
  }
  downloadFile(file);
}

export function canShareFile(file: File) {
  return Boolean(navigator.canShare?.({ files: [file] }));
}
