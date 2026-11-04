export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <article className={`nw-card ${className}`}>{children}</article>;
}
