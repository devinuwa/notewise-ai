export type BrainPhase = "idle" | "downloading" | "ready" | "failed";

export type BrainSnap = {
  phase: BrainPhase;
  progress: number;
  revision: number;
};

const SERVER_SNAP: BrainSnap = { phase: "idle", progress: 0, revision: 0 };

let snap: BrainSnap = SERVER_SNAP;
const listeners = new Set<() => void>();

function publish(next: BrainSnap) {
  if (next.phase === snap.phase && next.progress === snap.progress && next.revision === snap.revision) return;
  snap = next;
  listeners.forEach((listener) => listener());
}

export function getBrain() {
  return snap;
}

export function getServerBrain() {
  return SERVER_SNAP;
}

export function subscribeBrain(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setBrain(patch: Partial<Pick<BrainSnap, "phase" | "progress">>) {
  publish({ ...snap, ...patch });
}

/** Search reads this so a finished index replaces keyword hits with meaning hits. */
export function bumpIndex() {
  publish({ ...snap, revision: snap.revision + 1 });
}
