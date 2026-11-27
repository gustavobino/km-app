import { cn } from "@/lib/cn";

export type DayBar = {
  key: string;
  label: string;
  value: number;
  best?: boolean;
  /** Spoken name when the bars can be tapped, e.g. "2ª semana: R$ 450". */
  ariaLabel?: string;
};

type DayBarsProps = {
  bars: readonly DayBar[];
  /** Accessible summary, e.g. "Quanto sobrou por dia. O melhor dia foi sábado, com R$ 330". */
  label: string;
  /** Height of the tallest bar in px. */
  height?: number;
  /** Many thin bars (12 months): smaller gap and label. */
  compact?: boolean;
  /** Tappable bars: the selected one gets an outline. */
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  className?: string;
};

const MIN_BAR = 28; // the label must fit inside the bar

/** Mini bars on the lime hero: lime-bar fill, best day in ink with lime label. */
export function DayBars({
  bars,
  label,
  height = 56,
  compact = false,
  selectedKey = null,
  onSelect,
  className,
}: DayBarsProps) {
  const max = Math.max(0, ...bars.map((b) => b.value));
  const interactive = Boolean(onSelect);
  return (
    <div
      role={interactive ? "group" : "img"}
      aria-label={label}
      className={cn("flex items-end", compact ? "gap-1" : "gap-2", className)}
      style={{ height }}
    >
      {bars.map((b) => {
        const h =
          max > 0
            ? MIN_BAR + ((height - MIN_BAR) * Math.max(0, b.value)) / max
            : MIN_BAR;
        const look = cn(
          "box-border flex flex-1 items-end justify-center pb-1.25 font-extrabold",
          compact ? "rounded-md text-[11px]" : "rounded-lg text-xs",
          b.best ? "bg-ink text-lime" : "bg-lime-bar text-white",
          selectedKey === b.key && "outline-2 outline-offset-2 outline-ink",
        );
        if (!interactive)
          return (
            <div
              key={b.key}
              aria-hidden="true"
              className={look}
              style={{ height: Math.round(h) }}
            >
              {b.label}
            </div>
          );
        return (
          // The bar is short, but the button fills the whole column (≥ 44 px tall).
          <button
            key={b.key}
            type="button"
            aria-pressed={selectedKey === b.key}
            aria-label={b.ariaLabel ?? b.label}
            onClick={() => onSelect!(b.key)}
            className="flex h-full min-w-0 flex-1 items-end"
          >
            <span
              className={cn(look, "w-full")}
              style={{ height: Math.round(h) }}
            >
              {b.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
