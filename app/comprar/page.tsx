import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Purchase } from "@/components/compra/Purchase";
import { can } from "@/lib/entitlements";
import { getAccessUser } from "@/lib/entitlements-server";
import { REFUND_DAYS, priceCents } from "@/lib/payments/config";

export const metadata: Metadata = { title: "Comprar" };

export default async function PurchasePage({
  searchParams,
}: PageProps<"/comprar">) {
  const user = await getAccessUser();
  if (!user) redirect("/entrar?next=%2Fcomprar");
  if (can(user, "app")) redirect("/registrar");
  const { status } = await searchParams;
  const state =
    status === "sucesso" || status === "pendente"
      ? "waiting"
      : status === "falha"
        ? "failed"
        : "idle";
  return (
    <Purchase
      priceCents={priceCents()}
      refundDays={REFUND_DAYS}
      state={state}
    />
  );
}
