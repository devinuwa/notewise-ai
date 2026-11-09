export type TextSize = "md" | "lg" | "xl";

export const TEXT_SIZES: TextSize[] = ["md", "lg", "xl"];

export const TEXT_SIZE_LABEL: Record<TextSize, string> = {
  md: "Medium",
  lg: "Large",
  xl: "Extra large",
};

export function isTextSize(value: unknown): value is TextSize {
  return value === "md" || value === "lg" || value === "xl";
}

/** Root font-size multipliers applied on <html data-text-size>. */
export const TEXT_SIZE_CSS: Record<TextSize, string> = {
  md: "16px",
  lg: "18px",
  xl: "20px",
};
