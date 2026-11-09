"use client";

/** Subscribe to online/offline. Server snapshot is always online. */
export function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function onlineSnapshot() {
  return navigator.onLine;
}

export function onlineServerSnapshot() {
  return true;
}

export const OFFLINE_CLOUD_OCR =
  "Cloud reading needs the internet. Switch to On-device reading in Settings, or reconnect and try again.";

export const OFFLINE_TUTOR =
  "New tutor answers need the internet. You can still read earlier chats saved on this device.";

export const OFFLINE_DRIVE =
  "Google Drive needs the internet. Your notes stay on this device until you reconnect.";

export const OFFLINE_QUIZ =
  "Making a new quiz needs the internet. You can still take quizzes already saved on this device.";
