"use client";

import { motion } from "framer-motion";

export function Reveal({
  delay = 0,
  reduce,
  as = "div",
  className,
  children,
}: {
  delay?: number;
  reduce: boolean;
  as?: "div" | "span";
  className?: string;
  children: React.ReactNode;
}) {
  if (reduce) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }
  const MotionTag = as === "span" ? motion.span : motion.div;
  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.3, 1.6, 0.5, 1] }}
    >
      {children}
    </MotionTag>
  );
}
