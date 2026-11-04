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

type ButtonAsLink = Common & { href: string };

function classes(variant: Variant, className?: string) {
  return ["nw-btn", variant === "secondary" ? "nw-btn-secondary" : "", className]
    .filter(Boolean)
    .join(" ");
}

export function Button(props: ButtonAsButton | ButtonAsLink) {
  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={classes(props.variant ?? "primary", props.className)}>
        {props.children}
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
