"use client";

import { useState, useTransition } from "react";
import { grantAccess, revokeAccess } from "@/app/admin/actions";

export function AdminUserRow(props: {
  userId: string;
  email: string;
  status: string;
  hasAccess: boolean;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <li className="flex flex-col gap-1 border-t border-divider py-2.5 first:border-t-0">
      <span className="text-[15px] font-bold break-all">{props.email}</span>
      <span className="text-[13px] font-semibold text-muted">
        {props.status}
      </span>
      <div className="flex gap-2">
        {props.hasAccess ? (
          <button
            type="button"
            disabled={pending}
            className="h-touch rounded-button border-[1.5px] border-chip-border px-3 text-[14px] font-extrabold"
            onClick={() => {
              const reason = window.prompt(
                "Motivo da revogação (ex.: reembolso em 7 dias)",
                "reembolso",
              );
              if (!reason) return;
              start(async () => {
                const r = await revokeAccess(props.userId, reason);
                setMsg(r.ok ? "Acesso revogado." : r.error);
              });
            }}
          >
            Revogar acesso
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            className="h-touch rounded-button bg-ink px-3 text-[14px] font-extrabold text-lime"
            onClick={() =>
              start(async () => {
                const r = await grantAccess(props.userId);
                setMsg(r.ok ? "Acesso liberado." : r.error);
              })
            }
          >
            Dar acesso
          </button>
        )}
      </div>
      {msg ? (
        <span role="status" className="text-[13px] font-bold">
          {msg}
        </span>
      ) : null}
    </li>
  );
}
