import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Card } from "./Card";

/** Grey placeholder block for loading states. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-card bg-segment-bg", className)}
    />
  );
}

/** Friendly empty state: title, one line, one action. */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-8 text-center">
      {icon ? (
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-[14px] bg-bg"
        >
          {icon}
        </span>
      ) : null}
      <h2 className="font-display text-[22px] leading-tight font-extrabold">
        {title}
      </h2>
      {description ? (
        <p className="text-sm font-semibold text-muted">{description}</p>
      ) : null}
      {action}
    </Card>
  );
}

/** Error with a clear action. */
export function ErrorState({
  message,
  action,
}: {
  message: string;
  action?: ReactNode;
}) {
  return (
    <Card role="alert" className="flex flex-col gap-3 px-5 py-5">
      <p className="text-[15px] font-bold">{message}</p>
      {action}
    </Card>
  );
}
