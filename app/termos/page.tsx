import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { legalDocument } from "@/lib/legal/config";

export const metadata: Metadata = { title: "Termos de uso" };
export const dynamic = "force-static";

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-column flex-col gap-4 px-5 pt-6 pb-12">
      <Link
        href="/"
        className="font-display text-[22px] font-extrabold tracking-hero"
      >
        Km+
      </Link>
      <LegalDocument blocks={legalDocument("termos")} />
    </main>
  );
}
