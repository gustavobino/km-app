# Hospedagem no Cloudflare (grátis, permite uso comercial)

O Km+ roda no **Cloudflare Workers** (plano Free: 100 mil requisições/dia) com o adaptador **OpenNext** (`@opennextjs/cloudflare`).

## Arquivos
- `wrangler.jsonc` — configuração do Worker (`km-app`), sem R2/KV (o plano grátis não exige cartão).
- `open-next.config.ts` — configuração do OpenNext (sem cache incremental: o app não usa ISR).
- `middleware.ts` — de propósito no formato **middleware (Edge)**, não `proxy.ts`: o `proxy.ts` do Next 16 roda em Node.js, que o OpenNext marca como experimental e que quebrava (erro 500) em requisições de usuários logados.
- `scripts/gen-legal.mjs` — embute `legal/*.md` no código no build (Workers não tem sistema de arquivos).

## Comandos
- `pnpm cf:build` — build para o Cloudflare (gera `.open-next/`).
- `pnpm cf:preview` — build + roda localmente no `workerd` (o mesmo motor do Cloudflare).
- `pnpm cf:deploy` — build + publica (precisa de login no Cloudflare).

## Verificação (24/11/2026)
Suíte de ponta a ponta rodada contra o build do Cloudflare em `workerd`: 106 testes passaram; 4 falharam só por limitações do ambiente de teste (endereço local fora da lista do Supabase e sem token do Mercado Pago).

## Variáveis
| Onde (Cloudflare) | Nome | Observação |
|---|---|---|
| **Build** (Settings → Build → Variables) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_AUTH_OTP_CODE=true` | entram no código na hora do build |
| **Worker** (Settings → Variables and Secrets) | `SUPABASE_SERVICE_ROLE_KEY` (secret), `MERCADOPAGO_ACCESS_TOKEN` (secret), `MERCADOPAGO_WEBHOOK_SECRET` (secret), `ADMIN_EMAILS`, `LEGAL_CONTROLLER_NAME` | lidas em tempo de execução |
| `wrangler.jsonc` | `PRICE_BRL_CENTS=1790` | não é segredo |

## Erro "Mercado Pago preference failed: HTTP 403 PA_UNAUTHORIZED_RESULT_FROM_POLICIES"

Quer dizer que o `MERCADOPAGO_ACCESS_TOKEN` cadastrado no Cloudflare não serve (em 24/11/2026 era a chave errada). Copie de novo o **Access Token** (o mais longo; não a Public Key) no Mercado Pago e cole no segredo do Worker. O Cloudflare chama o Mercado Pago direto, sem nenhum desvio.
