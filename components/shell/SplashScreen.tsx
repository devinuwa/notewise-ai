import { PixelLoader } from "@/components/ui/PixelLoader";

/** Static first paint while SplashGate waits for the pathname. No hooks, so it can be prerendered. */
export function SplashScreen() {
  return (
    <div className="splash" role="status" aria-live="polite" aria-label="Loading NoteWise">
      <PixelLoader />
    </div>
  );
}
