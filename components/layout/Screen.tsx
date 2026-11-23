import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Page column: 390 px base, up to 480 px centered on desktop, 20 px gutters, 12 px between cards. */
export function Screen({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full max-w-column flex-col gap-gap-card px-5 pt-6 pb-[calc(var(--spacing-tabbar)+24px+env(safe-area-inset-bottom))]",
        className,
      )}
    >
      {children}
    </main>
  );
}

/** Screen title (Bricolage 800, 30–32 px) with optional small caption and trailing slot. */
export function ScreenHeader({
  title,
  caption,
  captionPosition = "end",
  trailing,
  size = 30,
}: {
  title: string;
  caption?: string;
  captionPosition?: "above" | "end" | "below";
  trailing?: ReactNode;
  size?: 26 | 30 | 32;
}) {
  const sizeClass =
    size === 32 ? "text-[32px]" : size === 26 ? "text-[26px]" : "text-[30px]";
  const captionEl = caption ? (
    <span className="text-[13px] font-semibold text-muted">{caption}</span>
  ) : null;
  return (
    <header
      className={cn(
        captionPosition === "end"
          ? "flex items-end justify-between gap-3"
          : "flex flex-col",
      )}
    >
      {captionPosition === "above" ? captionEl : null}
      <div className="flex items-center justify-between gap-3">
        <h1
          className={cn(
            "font-display leading-[1.1] font-extrabold",
            sizeClass,
            captionPosition === "above" && "mt-1",
          )}
        >
          {title}
        </h1>
        {captionPosition !== "end" ? trailing : null}
      </div>
      {captionPosition === "end" ? (
        <span className="flex items-center gap-2 pb-0.75">
          {captionEl}
          {trailing}
        </span>
      ) : null}
      {captionPosition === "below" ? (
        <div className="mt-1">{captionEl}</div>
      ) : null}
    </header>
  );
}
