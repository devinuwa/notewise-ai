"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { NAV_ITEMS, isActive } from "@/components/shell/nav";
import { Wordmark } from "@/components/shell/Wordmark";

export function Header() {
  const pathname = usePathname();
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const open = menuPath === pathname;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuPath(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b-2 border-ink bg-green-600">
      <a href="#content" className="skip-link nw-mono text-[12px]">
        Skip to content
      </a>
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Wordmark />
        <nav className="hidden items-center gap-5 md:flex" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={`nw-mono text-[12px] text-paper no-underline ${
                isActive(pathname, item.href) ? "underline decoration-yellow decoration-2 underline-offset-8" : ""
              }`}
            >
              {item.label}
            </Link>
          ))}
          <Button href="/">My NoteWise</Button>
        </nav>
        <button
          type="button"
          className="nw-btn nw-btn-secondary md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setMenuPath(open ? null : pathname)}
        >
          {open ? <X aria-hidden size={16} /> : <Menu aria-hidden size={16} />}
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open ? (
        <div id="mobile-menu" className="border-t-2 border-ink bg-paper px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-3" aria-label="Main">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className="nw-mono text-[13px] text-ink no-underline"
              >
                {item.label}
              </Link>
            ))}
            <Button href="/">My NoteWise</Button>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
