"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CapsLabel, Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { today, type LocalDate } from "@/lib/dates";
import { localDb } from "@/lib/local/db";
import { listLocalDays } from "@/lib/local/days";
import type { PlatformSetting } from "@/lib/metrics/types";
import {
  REPORT_PERIODS,
  buildEarningsReport,
  reportMonths,
  type ReportPeriod,
} from "@/lib/report/earnings";

type Props = { userId: string; platformSettings: PlatformSetting[] };

const NAME_KEY = "kmplus:relatorio-nome";

function readName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Card + sheet that builds the "Relatório de ganhos" PDF on the device. */
export function EarningsReportCard({ userId, platformSettings }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Card
      as="section"
      aria-label="Relatório de ganhos"
      className="px-4 pt-3.5 pb-4"
    >
      <CapsLabel as="h2">Relatório de ganhos · PDF</CapsLabel>
      <p className="mt-1 text-[14px] font-semibold text-muted">
        Seus ganhos mês a mês num PDF para mostrar ao alugar um imóvel, pedir
        crédito ou financiar o carro.
      </p>
      <Button
        variant="secondary"
        block
        className="mt-3"
        onClick={() => setOpen(true)}
      >
        Gerar relatório
      </Button>
      {open ? (
        <ReportSheet
          userId={userId}
          platformSettings={platformSettings}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </Card>
  );
}

function ReportSheet({
  userId,
  platformSettings,
  onClose,
}: Props & { onClose: () => void }) {
  const [todayDate] = useState<LocalDate>(() => today());
  const [period, setPeriod] = useState<ReportPeriod>("3m");
  const [name, setName] = useState(readName);
  const [status, setStatus] = useState<
    "idle" | "busy" | "done" | "empty" | "error"
  >("idle");
  const nameId = useId();

  async function generate() {
    setStatus("busy");
    try {
      try {
        localStorage.setItem(NAME_KEY, name.trim());
      } catch {
        // Storage blocked: the name is just not remembered.
      }
      const months = reportMonths(period, todayDate);
      const days = await listLocalDays(localDb(), userId, {
        start: months[0]!,
        end: todayDate,
      });
      const report = buildEarningsReport(
        days,
        period,
        platformSettings,
        todayDate,
      );
      if (!report.hasData) {
        setStatus("empty");
        return;
      }
      const { renderEarningsPdf } = await import("@/lib/report/pdf");
      const bytes = await renderEarningsPdf({
        report,
        driverName: name,
        generatedOn: `${todayDate.slice(8, 10)}/${todayDate.slice(5, 7)}/${todayDate.slice(0, 4)}`,
      });
      const fileName = `kmplus-relatorio-${months[0]!.slice(0, 7)}-a-${months[months.length - 1]!.slice(0, 7)}.pdf`;
      const file = new File([bytes as BlobPart], fileName, {
        type: "application/pdf",
      });
      // On phones, the share sheet sends it straight to WhatsApp or e-mail.
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "Relatório de ganhos",
          });
          setStatus("done");
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") {
            setStatus("idle");
            return;
          }
          // Sharing failed: fall back to downloading.
        }
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <Sheet open onClose={onClose} title="Relatório de ganhos">
      <form
        className="flex flex-col gap-gap-card"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void generate();
        }}
      >
        <fieldset>
          <legend className="mb-2 label-caps text-muted">Período</legend>
          <div className="flex flex-wrap gap-2">
            {REPORT_PERIODS.map((p) => (
              <Chip
                key={p.value}
                selected={period === p.value}
                aria-pressed={period === p.value}
                onClick={() => {
                  setPeriod(p.value);
                  setStatus("idle");
                }}
              >
                {p.label}
              </Chip>
            ))}
          </div>
          <p className="mt-2 text-[12px] font-semibold text-muted">
            {period === "year"
              ? "De janeiro até hoje."
              : "Meses completos, sem contar o mês atual."}
          </p>
        </fieldset>

        <Card className="px-4 py-3">
          <label htmlFor={nameId} className="block label-caps text-muted">
            Seu nome no relatório (opcional)
          </label>
          <input
            id={nameId}
            value={name}
            maxLength={80}
            autoComplete="name"
            placeholder="Ex.: Maria da Silva"
            onChange={(e) => setName(e.target.value)}
            className="h-10 w-full bg-transparent text-[17px] font-bold outline-none placeholder:text-muted/60"
          />
        </Card>

        <p className="text-[12px] font-semibold text-muted">
          O relatório mostra os valores que você registrou no Km+ e avisa que
          não é documento oficial das plataformas. Ele é gerado no seu celular.
        </p>

        <p aria-live="polite" className="text-[14px] font-bold empty:hidden">
          {status === "empty"
            ? "Nenhum ganho registrado nesse período."
            : status === "error"
              ? "Não deu para gerar o PDF agora. Tente de novo."
              : status === "done"
                ? "Relatório pronto."
                : ""}
        </p>

        <Button type="submit" block disabled={status === "busy"}>
          {status === "busy" ? "Gerando…" : "Gerar PDF"}
        </Button>
      </form>
    </Sheet>
  );
}
