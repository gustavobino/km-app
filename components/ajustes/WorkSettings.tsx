"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { saveWorkSettings } from "@/app/(app)/ajustes/actions";
import { Button } from "@/components/ui/Button";
import { CapsLabel, Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { parseBRL, toInputBRL } from "@/lib/money";
import { formatHoursDecimal, parseHours } from "@/lib/units";

type Props = {
  apps: string[];
  goalCents: number | null;
  hoursPerDay: number | null;
  daysPerMonth: number | null;
};

/** Apps, monthly goal and routine (the onboarding answers), editable. */
export function WorkSettings(props: Props) {
  const router = useRouter();
  const others0 = props.apps.filter((a) => a !== "uber" && a !== "99");
  const [uber, setUber] = useState(props.apps.includes("uber"));
  const [n99, setN99] = useState(props.apps.includes("99"));
  const [others, setOthers] = useState<string[]>(
    others0.length ? others0 : [""],
  );
  const [goal, setGoal] = useState(
    props.goalCents ? toInputBRL(props.goalCents).replace(/,00$/, "") : "",
  );
  const [hours, setHours] = useState(
    props.hoursPerDay
      ? formatHoursDecimal(Math.round(props.hoursPerDay * 60))
      : "",
  );
  const [days, setDays] = useState(
    props.daysPerMonth ? String(props.daysPerMonth) : "",
  );
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const ids = { goal: useId(), hours: useId(), days: useId() };

  async function save() {
    setMsg(null);
    const goalCents = goal.trim() ? parseBRL(goal) : null;
    const minutes = hours.trim() ? parseHours(hours) : null;
    const d = days.trim() ? Number(days) : null;
    if (goal.trim() && goalCents == null)
      return setMsg({ ok: false, text: "Confira a meta. Exemplo: 6.000" });
    if (hours.trim() && (minutes == null || minutes < 30))
      return setMsg({
        ok: false,
        text: "Confira as horas por dia. Exemplo: 8,5",
      });
    if (d != null && (!Number.isInteger(d) || d < 1 || d > 31))
      return setMsg({ ok: false, text: "Dias por mês: de 1 a 31." });
    setBusy(true);
    const r = await saveWorkSettings({
      apps: { uber, n99, others },
      goalCents,
      hoursPerDay:
        minutes != null ? Math.round((minutes / 60) * 100) / 100 : null,
      daysPerMonth: d,
    }).catch(() => ({
      ok: false as const,
      error: "Sem internet agora. Tente de novo quando tiver sinal.",
    }));
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: "Salvo." } : { ok: false, text: r.error });
    if (r.ok) router.refresh();
  }

  return (
    <Card
      as="section"
      aria-labelledby="trabalho"
      className="flex flex-col gap-3 px-4 pt-3.5 pb-4"
    >
      <CapsLabel as="h2" id="trabalho">
        Seu trabalho
      </CapsLabel>
      <div
        role="group"
        aria-label="Apps em que você roda"
        className="flex flex-wrap gap-2"
      >
        <Chip
          selected={uber}
          aria-pressed={uber}
          onClick={() => setUber(!uber)}
        >
          Uber
        </Chip>
        <Chip selected={n99} aria-pressed={n99} onClick={() => setN99(!n99)}>
          99
        </Chip>
      </div>
      {others.map((name, i) => (
        <label key={i} className="flex flex-col">
          <span className="text-[11px] font-bold tracking-[0.06em] text-muted uppercase">
            Outro app{others.length > 1 ? ` ${i + 1}` : ""}
          </span>
          <input
            value={name}
            maxLength={40}
            placeholder="Ex.: inDrive (opcional)"
            onChange={(e) =>
              setOthers(others.map((o, j) => (j === i ? e.target.value : o)))
            }
            className="h-touch border-b border-divider bg-transparent text-[16px] font-bold outline-none placeholder:font-semibold placeholder:text-muted/60"
          />
        </label>
      ))}
      {others.length < 8 ? (
        <button
          type="button"
          onClick={() => setOthers([...others, ""])}
          className="h-touch self-start text-[14px] font-extrabold"
        >
          + adicionar outro app
        </button>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        <label
          htmlFor={ids.goal}
          className="col-span-3 -mb-2 text-[11px] font-bold tracking-[0.06em] text-muted uppercase"
        >
          Meta de sobra por mês
        </label>
        <div className="col-span-3 rounded-segment-item bg-bg px-3 py-1">
          <MoneyInput
            id={ids.goal}
            value={goal}
            onChange={setGoal}
            placeholder="6.000"
            sizeClass="text-[24px]"
          />
        </div>
        <label
          className="col-span-1 flex flex-col rounded-segment-item bg-bg px-3 py-2"
          htmlFor={ids.hours}
        >
          <span className="text-[11px] font-bold tracking-[0.06em] text-muted uppercase">
            Horas/dia
          </span>
          <input
            id={ids.hours}
            inputMode="decimal"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="h-9 bg-transparent font-display text-[22px] font-extrabold outline-none"
          />
        </label>
        <label
          className="col-span-2 flex flex-col rounded-segment-item bg-bg px-3 py-2"
          htmlFor={ids.days}
        >
          <span className="text-[11px] font-bold tracking-[0.06em] text-muted uppercase">
            Dias por mês
          </span>
          <input
            id={ids.days}
            inputMode="numeric"
            value={days}
            onChange={(e) =>
              setDays(e.target.value.replace(/\D/g, "").slice(0, 2))
            }
            className="h-9 bg-transparent font-display text-[22px] font-extrabold outline-none"
          />
        </label>
      </div>
      {msg ? (
        <p role={msg.ok ? "status" : "alert"} className="text-[14px] font-bold">
          {msg.text}
        </p>
      ) : null}
      <Button
        variant="secondary"
        block
        disabled={busy}
        onClick={() => void save()}
      >
        {busy ? "Salvando…" : "Salvar"}
      </Button>
    </Card>
  );
}
