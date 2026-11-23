"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

type Choice<T extends string> = { value: T; label: string; hint?: string };

type ChoiceListProps<T extends string> = {
  legend: string;
  /** Hide the legend visually when the screen title already says it. */
  legendHidden?: boolean;
  choices: readonly Choice<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
};

/** Single choice as big tappable rows (real radio inputs, keyboard-friendly). */
export function ChoiceList<T extends string>({
  legend,
  legendHidden,
  choices,
  value,
  onChange,
}: ChoiceListProps<T>) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend
        className={cn(legendHidden ? "sr-only" : "mb-2 label-caps text-muted")}
      >
        {legend}
      </legend>
      {choices.map((c) => {
        const checked = value === c.value;
        return (
          <label
            key={c.value}
            className={cn(
              "flex min-h-15 cursor-pointer items-center gap-3.5 rounded-card border px-4 py-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
              checked
                ? "border-ink bg-ink text-white"
                : "border-border bg-surface",
            )}
          >
            <input
              type="radio"
              name={name}
              value={c.value}
              checked={checked}
              onChange={() => onChange(c.value)}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className={cn(
                "flex size-5.5 flex-none items-center justify-center rounded-full border-2",
                checked ? "border-lime" : "border-chip-border",
              )}
            >
              {checked ? (
                <span className="size-2.5 rounded-full bg-lime" />
              ) : null}
            </span>
            <span className="flex flex-col">
              <span className="text-[17px] font-extrabold">{c.label}</span>
              {c.hint ? (
                <span
                  className={cn(
                    "text-[13px] font-semibold",
                    checked ? "text-white/80" : "text-muted",
                  )}
                >
                  {c.hint}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
