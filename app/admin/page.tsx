import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminUserRow } from "@/components/admin/AdminUserRow";
import { CapsLabel, Card } from "@/components/ui/Card";
import { isAdminEmail } from "@/lib/admin";
import { formatBRL } from "@/lib/money";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

/** Minimal admin: find a user by e-mail, grant/revoke access, see recent payments. */
export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (
    !isAdminEmail(
      typeof data?.claims?.email === "string" ? data.claims.email : null,
    )
  )
    notFound();

  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().toLowerCase() : "";
  const db = adminClient();

  const { data: list } = await db.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const users = (list?.users ?? [])
    .filter((u) =>
      query ? (u.email ?? "").toLowerCase().includes(query) : true,
    )
    .slice(0, 30);
  const ids = users.map((u) => u.id);
  const [{ data: ents }, { data: pays }] = await Promise.all([
    ids.length
      ? db
          .from("entitlements")
          .select("user_id,source,granted_at,revoked_at")
          .in("user_id", ids)
          .order("granted_at", { ascending: false })
      : Promise.resolve({
          data: [] as Array<{
            user_id: string;
            source: string;
            granted_at: string;
            revoked_at: string | null;
          }>,
        }),
    db
      .from("payments")
      .select(
        "provider_payment_id,status,amount_cents,paid_at,created_at,user_id",
      )
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const emailOf = new Map(
    (list?.users ?? []).map((u) => [u.id, u.email ?? "—"]),
  );

  return (
    <main className="mx-auto flex w-full max-w-column flex-col gap-gap-card px-5 pt-6 pb-10">
      <h1 className="font-display text-[30px] leading-[1.1] font-extrabold">
        Admin
      </h1>
      <form className="flex gap-2" action="/admin">
        <label htmlFor="q" className="sr-only">
          Buscar por e-mail
        </label>
        <input
          id="q"
          name="q"
          defaultValue={query}
          placeholder="Buscar por e-mail"
          className="h-touch flex-1 rounded-button border border-border bg-surface px-3 text-[15px] font-semibold outline-none"
        />
        <button
          type="submit"
          className="h-touch rounded-button bg-ink px-4 font-extrabold text-lime"
        >
          Buscar
        </button>
      </form>

      <Card
        as="section"
        aria-labelledby="usuarios"
        className="px-4 pt-3.5 pb-2"
      >
        <CapsLabel as="h2" id="usuarios">
          Usuários ({users.length})
        </CapsLabel>
        <ul className="mt-1">
          {users.map((u) => {
            const active = (ents ?? []).find(
              (e) => e.user_id === u.id && !e.revoked_at,
            );
            return (
              <AdminUserRow
                key={u.id}
                userId={u.id}
                email={u.email ?? "—"}
                status={
                  active
                    ? `Com acesso (${active.source === "manual" ? "manual" : "compra"}) desde ${fmtDate(active.granted_at)}`
                    : "Sem acesso"
                }
                hasAccess={Boolean(active)}
              />
            );
          })}
        </ul>
      </Card>

      <Card
        as="section"
        aria-labelledby="pagamentos"
        className="px-4 pt-3.5 pb-3"
      >
        <CapsLabel as="h2" id="pagamentos">
          Últimos pagamentos
        </CapsLabel>
        <ul className="mt-1 text-[13px]">
          {(pays ?? []).length === 0 ? (
            <li className="py-2 font-semibold text-muted">
              Nenhum pagamento ainda.
            </li>
          ) : null}
          {(pays ?? []).map((p) => (
            <li
              key={p.provider_payment_id}
              className="flex justify-between gap-2 border-t border-divider py-2 first:border-t-0"
            >
              <span className="min-w-0 truncate font-semibold">
                {p.user_id ? emailOf.get(p.user_id) : "—"}
              </span>
              <span className="font-bold whitespace-nowrap">
                {formatBRL(p.amount_cents)} · {p.status} ·{" "}
                {fmtDate(p.paid_at ?? p.created_at)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <p className="px-1 text-[12px] font-semibold text-muted">
        Reembolso: estorne no painel do Mercado Pago. O acesso é revogado
        sozinho quando o Mercado Pago avisar; aqui dá para revogar na mão.
      </p>
    </main>
  );
}
