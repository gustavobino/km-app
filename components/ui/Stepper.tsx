"use client";

import { cn } from "@/lib/cn";

type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  /** Accessible name of the number, e.g. "Dias por semana". */
  label: string;
  /** Unit shown after the number. */
  unit?: string;
  className?: string;
};

/** − value + control with 44 px buttons. */
export function Stepper({
  value,
  onChange,
  min,
  max,
  label,
  unit,
  className,
}: StepperProps) {
  const btn =
    "flex size-touch items-center justify-center rounded-button bg-bg text-[24px] font-extrabold disabled:opacity-40";
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <button
        type="button"
        className={btn}
        aria-label={`Diminuir ${label.toLowerCase()}`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <output
        aria-live="polite"
        aria-label={label}
        className="flex items-baseline gap-1.5"
      >
        <span className="font-display text-[34px] leading-none font-extrabold">
          {value}
        </span>
        {unit ? <span className="font-bold text-muted">{unit}</span> : null}
      </output>
      <button
        type="button"
        className={btn}
        aria-label={`Aumentar ${label.toLowerCase()}`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );
}
