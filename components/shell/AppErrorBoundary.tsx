"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

type Props = { children: ReactNode };
type State = { error: Error | null; copied: boolean };

/** Catches render crashes so the student sees a friendly recovery screen. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, copied: false };

  static getDerivedStateFromError(error: Error): State {
    return { error, copied: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("NoteWise error boundary", error, info.componentStack);
  }

  async copyError() {
    const error = this.state.error;
    if (!error) return;
    const text = `${error.name}: ${error.message}\n\n${error.stack ?? ""}`;
    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
    } catch {
      this.setState({ copied: false });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="nw-page mx-auto flex min-h-dvh w-full max-w-[720px] flex-col justify-center">
        <p className="nw-mono text-[12px] text-muted">Something went wrong</p>
        <h1 className="nw-display mt-3 text-[clamp(36px,8vw,64px)] text-ink">NoteWise hit a snag</h1>
        <p className="mt-4 text-lg text-ink">
          Your notes are still on this device. Try reloading the page. If it keeps happening, copy the error and share
          it when you ask for help.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button type="button" onClick={() => window.location.reload()}>
            Reload
          </Button>
          <Button type="button" variant="secondary" onClick={() => void this.copyError()}>
            {this.state.copied ? "Copied" : "Copy error"}
          </Button>
        </div>
        <pre className="mt-6 max-h-48 overflow-auto border-2 border-ink bg-paper p-3 font-mono text-[11px] text-ink whitespace-pre-wrap">
          {this.state.error.message}
        </pre>
      </main>
    );
  }
}
