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

## Pagamentos pelo Supabase (relay do Mercado Pago)

O Mercado Pago recusa chamadas que saem do Cloudflare Workers (HTTP 403 sem corpo, mesmo com User-Agent). Por isso, no Cloudflare, o app fala com o Mercado Pago pela Edge Function `mp-relay` do Supabase (`supabase/functions/mp-relay/index.ts`, plano grátis).

- `MERCADOPAGO_API_BASE` (em `wrangler.jsonc`, não é segredo) aponta para a função. Sem essa variável (Vercel, local), o app chama o Mercado Pago direto.
- A função só aceita criar preferência e consultar pagamento, e só de quem envia a chave secreta do Supabase (`x-relay-key`, conferida no próprio Supabase). O token do Mercado Pago continua só no Cloudflare.
- Deploy da função (Management API, `verify_jwt` desligado porque a autenticação é própria):

```bash
cd supabase/functions/mp-relay && curl -sS -X POST "https://api.supabase.com/v1/projects/bguifsyabtcvinzaajcy/functions/deploy?slug=mp-relay" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -F 'metadata={"entrypoint_path":"index.ts","name":"mp-relay","verify_jwt":false};type=application/json' -F "file=@index.ts;type=application/typescript"
```
