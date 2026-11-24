import "server-only";
import { formatBRL } from "@/lib/money";
import { priceCents } from "@/lib/payments/config";
import { LEGAL_MARKDOWN } from "./content.generated";
import { fillTemplate, parse, type Block } from "./markdown";

/** Date of the current text (update together with legal/*.md). */
export const LEGAL_UPDATED_AT = "24 de novembro de 2026";

/** legal/<name>.md (embedded at build time), fills placeholders from the environment and parses it. */
export function legalDocument(name: "termos" | "privacidade"): Block[] {
  const md = LEGAL_MARKDOWN[name];
  let price: string | undefined;
  try {
    price = formatBRL(priceCents());
  } catch {
    price = undefined;
  }
  return parse(
    fillTemplate(md, {
      CONTROLLER_NAME: process.env.LEGAL_CONTROLLER_NAME,
      CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
      PRICE: price,
      UPDATED_AT: LEGAL_UPDATED_AT,
    }),
  );
}
