"use client";

import { ArrowLeftIcon, CloudOffIcon } from "@/components/ui/icons";
import { formatLongDate, type LocalDate } from "@/lib/dates";
import type { SyncState } from "./useSync";

type Props = {
  date: LocalDate;
  isToday: boolean;
  onPrev: () => void;
  onNext?: () => void;
  onToday?: () => void;
  sync: SyncState;
};

function syncMessage(sync: SyncState): string | null {
  const n = sync.pending;
  if (n === 0) return null;
  const days = n === 1 ? "1 dia" : `${n} dias`;
  if (!sync.online) return `Sem internet · ${days} para enviar`;
  if (sync.failed)
    return `Não deu para enviar ${days}. Tocar para tentar de novo`;
  return `Enviando ${days}…`;
}

/** Date with previous/next day, plus a quiet sync status line. */
export function DayHeader({
  date,
  isToday,
  onPrev,
  onNext,
  onToday,
  sync,
}: Props) {
  const message = syncMessage(sync);
  const navBtn =
    "flex size-touch items-center justify-center rounded-full text-ink disabled:opacity-30";
  return (
    <header>
      <div className="flex items-center justify-between">
        <div className="-ml-3 flex items-center gap-0.5">
          <button
            type="button"
            className={navBtn}
            onClick={onPrev}
            aria-label="Dia anterior"
          >
            <ArrowLeftIcon width={18} height={18} />
          </button>
          <span
            className="text-[13px] font-semibold text-muted"
            aria-live="polite"
          >
            {formatLongDate(date)}
          </span>
          <button
            type="button"
            className={navBtn}
            onClick={onNext}
            disabled={!onNext}
            aria-label="Dia seguinte"
          >
            <ArrowLeftIcon width={18} height={18} className="rotate-180" />
          </button>
        </div>
        {onToday ? (
          <button
            type="button"
            onClick={onToday}
            className="h-touch px-1 text-[13px] font-extrabold"
          >
            Voltar para hoje
          </button>
        ) : null}
      </div>
      <h1 className="mt-1 font-display text-[32px] leading-[1.1] font-extrabold">
        {isToday ? "Como foi o dia?" : "Como foi esse dia?"}
      </h1>
      {message ? (
        <button
          type="button"
          onClick={() => void sync.sync()}
          disabled={!sync.online}
          className="mt-1 flex min-h-touch items-center gap-2 text-left text-[13px] font-bold text-muted disabled:cursor-default"
        >
          {!sync.online ? <CloudOffIcon /> : null}
          {message}
        </button>
      ) : null}
    </header>
  );
}
