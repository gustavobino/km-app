import { cn } from "@/lib/cn";

type ProgressBarProps = {
  /** 0..1 (clamped). */
  ratio: number;
  /** Accessible description, e.g. "80% da meta do mês". */
  label: string;
  onLime?: boolean;
  className?: string;
};

/** 12 px bar. On lime: ink fill on rgba(16,24,40,.2) track. On white: ink fill on `track`. */
export function ProgressBar({
  ratio,
  label,
  onLime = false,
  className,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "h-3 rounded-bar",
        onLime ? "bg-lime-track" : "bg-track",
        className,
      )}
    >
      <div className="h-3 rounded-bar bg-ink" style={{ width: `${pct}%` }} />
    </div>
  );
}
