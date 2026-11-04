export const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/scan", label: "Scan" },
  { href: "/library", label: "Library" },
  { href: "/practice", label: "Practice" },
  { href: "/tutor", label: "Tutor" },
] as const;

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
