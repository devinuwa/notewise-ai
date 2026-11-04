"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Camera, GraduationCap, House, MessageCircle } from "lucide-react";
import { NAV_ITEMS, isActive } from "@/components/shell/nav";

const ICONS = {
  "/": House,
  "/scan": Camera,
  "/library": BookOpen,
  "/practice": GraduationCap,
  "/tutor": MessageCircle,
} as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-ink bg-green-600 md:hidden"
    >
      <ul className="mx-auto grid max-w-[1200px] grid-cols-5 items-end px-2 pb-2 pt-1">
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.href];
          const active = isActive(pathname, item.href);
          const scan = item.href === "/scan";
          return (
            <li key={item.href} className="flex min-w-0 justify-center">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 w-full min-w-0 flex-col items-center justify-end gap-1 text-paper no-underline ${
                  scan ? "-mt-4" : ""
                }`}
              >
                <span
                  className={
                    scan
                      ? "grid h-14 w-14 place-items-center border-2 border-ink bg-salmon text-ink shadow-[4px_4px_0_var(--shadow)]"
                      : "grid h-8 w-8 place-items-center"
                  }
                >
                  <Icon aria-hidden size={scan ? 22 : 18} strokeWidth={2.4} />
                </span>
                <span
                  className={`nw-mono max-w-full text-center text-[9px] leading-none tracking-[0.04em] ${
                    active ? "underline decoration-yellow underline-offset-4" : ""
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
