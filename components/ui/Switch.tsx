"use client";

import { cn } from "@/lib/cn";

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
};

/** 52×30 track inside a 44 px touch target; on = ink track with lime knob. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  className,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-touch w-15 items-center justify-end bg-transparent p-0 disabled:opacity-50",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-7.5 w-13 items-center rounded-pill px-0.75 transition-colors",
          checked ? "justify-end bg-ink" : "justify-start bg-chip-border",
        )}
      >
        <span
          className={cn(
            "size-6 rounded-full",
            checked ? "bg-lime" : "bg-white",
          )}
        />
      </span>
    </button>
  );
}
