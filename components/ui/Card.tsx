import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

type PolymorphicProps<T extends ElementType> = {
  as?: T;
  className?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

/** White card with border, radius 20, no shadow. */
export function Card<T extends ElementType = "section">({
  as,
  className,
  children,
  ...rest
}: PolymorphicProps<T>) {
  const Tag = (as ?? "section") as ElementType;
  return (
    <Tag
      className={cn("rounded-card border border-border bg-surface", className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Lime hero card with ink text, radius 28 (or a smaller variant). */
export function HeroCard<T extends ElementType = "section">({
  as,
  className,
  children,
  radius = "hero",
  ...rest
}: PolymorphicProps<T> & { radius?: "hero" | "hero-md" | "hero-sm" }) {
  const Tag = (as ?? "section") as ElementType;
  const r =
    radius === "hero"
      ? "rounded-hero"
      : radius === "hero-md"
        ? "rounded-hero-md"
        : "rounded-hero-sm";
  return (
    <Tag className={cn("bg-lime text-ink", r, className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Upper-case 12 px label. `onLime` switches to the lime-text color. */
export function CapsLabel({
  children,
  onLime = false,
  className,
  as: Tag = "div",
  ...rest
}: {
  children: ReactNode;
  onLime?: boolean;
  className?: string;
  as?: ElementType;
} & Record<string, unknown>) {
  return (
    <Tag
      className={cn(
        "label-caps",
        onLime ? "text-lime-text" : "text-muted",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
