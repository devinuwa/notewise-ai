import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary";

type Common = {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
};

type ButtonAsButton = Common &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type ButtonAsLink = Common & {
  href: string;
  /** Full document load — use when soft nav can leave the previous route mounted. */
  hard?: boolean;
};

function classes(variant: Variant, className?: string) {
  return ["nw-btn", variant === "secondary" ? "nw-btn-secondary" : "", className]
    .filter(Boolean)
    .join(" ");
}

export function Button(props: ButtonAsButton | ButtonAsLink) {
  if ("href" in props && props.href) {
    const { href, hard, variant = "primary", className, children } = props;
    const classNames = classes(variant, className);
    // Native <a> avoids App Router soft-nav leftovers (seen leaving landing under /welcome).
    if (hard) {
      return (
        <a href={href} className={classNames}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={classNames}>
        {children}
      </Link>
    );
  }
  const { variant = "primary", className, children, ...rest } = props;
  return (
    <button className={classes(variant, className)} {...rest}>
      {children}
    </button>
  );
}
