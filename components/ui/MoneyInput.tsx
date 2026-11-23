"use client";

import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

type MoneyInputProps = Omit<
  ComponentPropsWithoutRef<"input">,
  "onChange" | "value"
> & {
  value: string;
  onChange: (value: string) => void;
  /** Font size class for the number. */
  sizeClass?: string;
};

/**
 * Text input for BRL amounts ("212,50"). Keeps the raw text; parse with
 * parseBRL. Uses the decimal keyboard on phones.
 */
export function MoneyInput({
  value,
  onChange,
  className,
  sizeClass = "text-[30px]",
  ...rest
}: MoneyInputProps) {
  return (
    <div className={cn("flex items-baseline gap-1.5", className)}>
      <span aria-hidden="true" className="text-[17px] font-bold text-muted">
        R$
      </span>
      <input
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
        className={cn(
          "w-full min-w-0 bg-transparent py-1 font-display font-extrabold tracking-display outline-none placeholder:text-muted/50",
          sizeClass,
        )}
        {...rest}
      />
    </div>
  );
}
