import { CapsLabel, Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { TodayGoal } from "@/lib/metrics/period";
import { formatBRL } from "@/lib/money";

/** "Meta de hoje" on Registrar: what today should leave to keep the month goal on track. */
export function TodayGoalCard({ goal }: { goal: TodayGoal }) {
  if (goal.monthReached)
    return (
      <Card className="px-4 py-3">
        <CapsLabel>Meta do mês batida</CapsLabel>
        <p className="mt-1 text-[15px] font-bold">
          O que entrar hoje é extra no bolso.
        </p>
      </Card>
    );
  const target = formatBRL(goal.targetCents, { cents: false });
  return (
    <Card className="px-4 py-3" aria-label="Meta de hoje">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <CapsLabel>Meta de hoje</CapsLabel>
          <div className="mt-0.5 font-display text-[24px] leading-none font-extrabold tracking-hero">
            {target}
          </div>
        </div>
        <p className="text-right text-[14px] font-bold">
          {goal.reachedToday
            ? goal.todayNetCents > goal.targetCents
              ? `Batida! +${formatBRL(goal.todayNetCents - goal.targetCents, { cents: false })}`
              : "Batida!"
            : `Faltam ${formatBRL(goal.missingCents, { cents: false })}`}
        </p>
      </div>
      <ProgressBar
        className="mt-2.5"
        ratio={goal.ratio}
        label={`${Math.round(goal.ratio * 100)}% da meta de hoje`}
      />
      <p className="mt-1.5 text-[12px] font-semibold text-muted">
        Para manter a meta do mês em dia.
      </p>
    </Card>
  );
}
