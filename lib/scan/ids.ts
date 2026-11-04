export function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `nw-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}
