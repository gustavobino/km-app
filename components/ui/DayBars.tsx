import { cn } from "@/lib/cn";

export type DayBar = {
  key: string;
  label: string;
  value: number;
  best?: boolean;
};

type DayBarsProps = {
  bars: readonly DayBar[];
  /** Accessible summary, e.g. "Quanto sobrou por dia. O melhor dia foi sábado, com R$ 330". */
  label: string;
  /** Height of the tallest bar in px. */
  height?: number;
  className?: string;
};

const MIN_BAR = 28; // the label must fit inside the bar

/** Mini bars on the lime hero: lime-bar fill, best day in ink with lime label. */
export function DayBars({ bars, label, height = 56, className }: DayBarsProps) {
  const max = Math.max(0, ...bars.map((b) => b.value));
  return (
    <div
      role="img"
      aria-label={label}
      className={cn("flex items-end gap-2", className)}
      style={{ height }}
    >
      {bars.map((b) => {
        const h =
          max > 0
            ? MIN_BAR + ((height - MIN_BAR) * Math.max(0, b.value)) / max
            : MIN_BAR;
        return (
          <div
            key={b.key}
            aria-hidden="true"
            className={cn(
              "box-border flex flex-1 items-end justify-center rounded-lg pb-1.25 text-xs font-extrabold",
              b.best ? "bg-ink text-lime" : "bg-lime-bar text-white",
            )}
            style={{ height: Math.round(h) }}
          >
            {b.label}
          </div>
        );
      })}
    </div>
  );
}
