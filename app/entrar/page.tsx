import type { Metadata } from "next";
import { safeNextPath } from "@/lib/auth/redirect";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/entrar">) {
  const params = await searchParams;
  const next = safeNextPath(
    typeof params.next === "string" ? params.next : null,
  );
  const linkError = params.erro === "link";
  const accountDeleted = params.conta === "excluida";
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-column flex-col px-5 pt-10 pb-8">
      <div className="font-display text-[28px] leading-none font-extrabold tracking-hero">
        Km+
      </div>
      <LoginForm
        next={next}
        linkError={linkError}
        accountDeleted={accountDeleted}
      />
      <p className="mt-auto pt-10 text-center text-xs font-semibold text-muted">
        Km+ não é afiliado à Uber nem à 99.
      </p>
    </main>
  );
}
