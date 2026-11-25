"use client";

import { useId, useState, useSyncExternalStore, useTransition } from "react";
import { saveReminder } from "@/app/(app)/ajustes/actions";
import { CapsLabel, Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { VAPID_PUBLIC_KEY } from "@/lib/push/config";
import { reminderTimes } from "@/lib/push/reminders";

type Support = "ok" | "ios-install" | "unsupported";

function detectSupport(): Support {
  if (typeof window === "undefined") return "ok";
  const ok =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  if (ok) return "ok";
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone ? "ios-install" : "unsupported";
}

const noop = () => () => {};

function toUint8(base64url: string): Uint8Array {
  const b64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function currentSubscription(create: boolean) {
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub && create)
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toUint8(
        VAPID_PUBLIC_KEY,
      ) as unknown as BufferSource,
    });
  if (!sub) return null;
  const json = sub.toJSON();
  return {
    endpoint: json.endpoint!,
    p256dh: json.keys!.p256dh!,
    auth: json.keys!.auth!,
  };
}

/** "Lembrete para fechar o dia" in Ajustes. */
export function ReminderSettings({
  enabled: initialEnabled,
  time: initialTime,
}: {
  enabled: boolean;
  time: string | null;
}) {
  const support = useSyncExternalStore(
    noop,
    detectSupport,
    () => "ok" as const,
  );
  const [enabled, setEnabled] = useState(initialEnabled);
  const [time, setTime] = useState(initialTime ?? "20:00");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const timeId = useId();

  function save(nextEnabled: boolean, nextTime: string) {
    setMessage(null);
    startTransition(async () => {
      try {
        if (nextEnabled && Notification.permission !== "granted") {
          const p = await Notification.requestPermission();
          if (p !== "granted") {
            setEnabled(false);
            setMessage(
              "As notificações estão bloqueadas. Libere nos ajustes do celular para o Km+ e tente de novo.",
            );
            return;
          }
        }
        const subscription = await currentSubscription(nextEnabled);
        const r = await saveReminder({
          enabled: nextEnabled,
          time: nextTime,
          subscription,
        });
        if (!r.ok) {
          setEnabled(!nextEnabled);
          setMessage(r.error);
          return;
        }
        setEnabled(nextEnabled);
        setTime(nextTime);
        setMessage(
          nextEnabled
            ? `Pronto. Às ${nextTime}, se o dia ainda não estiver fechado, avisamos.`
            : "Lembrete desligado.",
        );
      } catch {
        setEnabled(!nextEnabled);
        setMessage("Não deu para ligar o lembrete agora. Tente de novo.");
      }
    });
  }

  return (
    <Card
      as="section"
      id="lembrete"
      aria-labelledby={`${timeId}-t`}
      className="scroll-mt-4 px-4 pt-3.5 pb-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <CapsLabel as="h2" id={`${timeId}-t`}>
            Lembrete
          </CapsLabel>
          <div className="mt-0.5 text-[15px] font-extrabold">
            Avisar para fechar o dia
          </div>
        </div>
        {support === "ok" ? (
          <Switch
            label="Lembrete para fechar o dia"
            checked={enabled}
            disabled={pending}
            onChange={(v) => {
              setEnabled(v);
              save(v, time);
            }}
          />
        ) : null}
      </div>

      {support === "ios-install" ? (
        <p className="mt-2 text-[13px] font-semibold text-muted">
          No iPhone, o lembrete funciona com o Km+ instalado: no Safari, toque
          em Compartilhar e depois em “Adicionar à Tela de Início”. Abra o Km+
          pelo ícone e volte aqui.
        </p>
      ) : support === "unsupported" ? (
        <p className="mt-2 text-[13px] font-semibold text-muted">
          Este navegador não recebe notificações. Abra o Km+ pelo ícone
          instalado no celular.
        </p>
      ) : (
        <>
          <div className="mt-3 flex items-center justify-between gap-3">
            <label htmlFor={timeId} className="text-[14px] font-bold">
              Horário
            </label>
            <select
              id={timeId}
              value={time}
              disabled={pending}
              onChange={(e) => {
                setTime(e.target.value);
                if (enabled) save(true, e.target.value);
              }}
              className="h-touch rounded-button border border-border bg-surface px-3 text-[16px] font-bold"
            >
              {reminderTimes().map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-2 text-[12px] font-semibold text-muted">
            Só avisa se o dia ainda não estiver fechado. Uma vez por dia.
          </p>
        </>
      )}
      <p aria-live="polite" className="mt-2 text-[13px] font-bold empty:hidden">
        {message ?? ""}
      </p>
    </Card>
  );
}
