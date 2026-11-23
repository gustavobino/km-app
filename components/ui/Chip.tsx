import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CloseIcon } from "./icons";

type ChipProps = Omit<ComponentPropsWithoutRef<"button">, "children"> & {
  /** Filled (ink) when it has a value; outlined "+ Label" otherwise. */
  selected?: boolean;
  children: ReactNode;
  /** Shows the small × on selected chips. */
  removable?: boolean;
};

/** 44 px pill used for "Gastos do dia" and option pickers. */
export function Chip({
  selected = false,
  removable = false,
  className,
  children,
  type = "button",
  ...rest
}: ChipProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-touch items-center gap-2 rounded-chip px-3.5 text-sm font-bold",
        selected
          ? "border-0 bg-ink text-white"
          : "border-[1.5px] border-chip-border bg-surface text-ink",
        className,
      )}
      {...rest}
    >
      {children}
      {selected && removable ? <CloseIcon /> : null}
    </button>
  );
}
