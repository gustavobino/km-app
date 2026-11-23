import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex min-h-touch items-center justify-center gap-2 rounded-button px-5 font-extrabold transition-opacity disabled:opacity-50";
const variants: Record<Variant, string> = {
  // Primary: ink background, lime text (lime on dark is allowed; never lime on light).
  primary: "h-13 bg-ink text-[17px] text-lime",
  secondary:
    "h-13 border-[1.5px] border-chip-border bg-surface text-[16px] text-ink",
  ghost:
    "h-11 bg-transparent text-[15px] text-ink underline-offset-4 hover:underline",
};

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: Variant;
  block?: boolean;
};

export function Button({
  variant = "primary",
  block,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(base, variants[variant], block && "w-full", className)}
      {...rest}
    />
  );
}

type LinkButtonProps = ComponentPropsWithoutRef<typeof Link> & {
  variant?: Variant;
  block?: boolean;
};

export function LinkButton({
  variant = "primary",
  block,
  className,
  ...rest
}: LinkButtonProps) {
  return (
    <Link
      className={cn(base, variants[variant], block && "w-full", className)}
      {...rest}
    />
  );
}
