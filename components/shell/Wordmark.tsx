import Link from "next/link";

export function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2 text-paper no-underline">
      <span aria-hidden className="grid grid-cols-2 gap-px">
        <i className="block h-2.5 w-2.5 bg-paper" />
        <i className="block h-2.5 w-2.5 bg-red" />
        <i className="block h-2.5 w-2.5 bg-yellow" />
        <i className="block h-2.5 w-2.5 bg-blue" />
      </span>
      <span className="font-mono text-sm font-bold tracking-[0.14em]">NOTEWISE</span>
      <span className="border-2 border-ink bg-salmon px-1 py-0.5 font-mono text-[10px] font-bold leading-none text-ink">
        AI
      </span>
    </Link>
  );
}
