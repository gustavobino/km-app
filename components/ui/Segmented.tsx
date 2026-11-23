"use client";

import { cn } from "@/lib/cn";

type Option<T extends string> = { value: T; label: string };

type SegmentedProps<T extends string> = {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

/** Hoje / Semana / Mês selector: radius 16 outside, 12 per item, 44 px tall. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("grid gap-1 rounded-segment bg-segment-bg p-1", className)}
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-touch rounded-segment-item text-sm",
              active
                ? "bg-ink font-extrabold text-white"
                : "bg-transparent font-bold text-muted",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
