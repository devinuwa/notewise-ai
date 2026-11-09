"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Wordmark } from "@/components/shell/Wordmark";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "/privacy", label: "Privacy" },
  { href: "#faq", label: "FAQ" },
] as const;

export function LandingHeader({ openHref = "/?start=1" }: { openHref?: string }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b-2 border-ink bg-green-600">
      <a href="#content" className="skip-link nw-mono text-[12px]">
        Skip to content
      </a>
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Wordmark />
        <nav className="hidden items-center gap-5 lg:flex" aria-label="Landing">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="nw-mono text-[12px] text-paper no-underline">
              {link.label}
            </Link>
          ))}
          <Button href={openHref}>Open NoteWise</Button>
        </nav>
        <button
          type="button"
          className="nw-btn nw-btn-secondary min-h-11 lg:hidden"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X aria-hidden size={16} /> : <Menu aria-hidden size={16} />}
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open ? (
        <div id={menuId} className="border-t-2 border-ink bg-paper px-4 py-4 lg:hidden">
          <nav className="flex w-full flex-col gap-3" aria-label="Landing">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="nw-mono min-h-11 text-[13px] text-ink no-underline"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link href={openHref} className="nw-btn w-full" onClick={() => setOpen(false)}>
              Open NoteWise
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
