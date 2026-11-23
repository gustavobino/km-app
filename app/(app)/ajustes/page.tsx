import type { Metadata } from "next";
import Link from "next/link";
import { Screen, ScreenHeader } from "@/components/layout/Screen";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email =
    typeof data?.claims?.email === "string" ? data.claims.email : null;
  return (
    <Screen>
      <ScreenHeader title="Ajustes" />
      <Card className="px-4 py-3">
        <div className="label-caps text-muted">Conta</div>
        <div className="mt-1 text-[16px] font-bold break-words">
          {email ?? "—"}
        </div>
      </Card>
      <Link
        href="/onboarding"
        className="flex min-h-touch items-center rounded-card border border-border bg-surface px-4 text-[15px] font-extrabold"
      >
        Refazer as primeiras perguntas
      </Link>
      <p className="px-1 text-[13px] font-semibold text-muted">
        Perfil, carro, apps e exportar dados chegam no M8.
      </p>
      <SignOutButton />
    </Screen>
  );
}
