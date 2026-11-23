# Modelo de dados

Fonte: `db/migrations/0001_init.sql`. Banco: Supabase (Postgres). Este documento registra o que mudou em relação ao ponto de partida do `CLAUDE.md` e por quê.

## Convenções

| O quê | Como é guardado | Por quê |
|---|---|---|
| Dinheiro | `integer` em **centavos** | regra do `CLAUDE.md`; nada de float |
| Horas | `integer` em **minutos** (`minutes`) | mesma lógica: "8,5 h" vira 510, sem arredondamento acumulado |
| Km | `integer` | km fracionado não importa para o motorista |
| Litros, % de taxa, custo por km | `numeric` (decimal exato) | precisam de casas decimais; `numeric` não tem erro de float |
| Ids | `uuid`, podendo ser gerado no aparelho | permite criar registros offline e sincronizar com *upsert* idempotente |
| Datas do dia | `date` (dia civil de São Paulo) | o app converte com `lib/dates` |

Toda tabela tem `created_at` e `updated_at` (atualizado por trigger), usados pela sincronização ("último `updated_at` ganha").

## Tabelas

| Tabela | Diferenças em relação ao `CLAUDE.md` |
|---|---|
| `profiles` | `id` = `auth.users.id` (é o próprio `user_id`). Criada automaticamente por trigger no cadastro. `+ onboarding_completed_at`, `+ updated_at`. `typical_hours_per_day` é `numeric(4,2)` (ex.: 8,5). |
| `vehicles` | Uma por usuário no v1 (`unique(user_id)`). `rent_period`: `day/week/month`. `+ maintenance_cents_per_km` e `tires_cents_per_km` opcionais: quando o motorista edita a estimativa, o valor dele substitui a referência. |
| `platform_settings` | `+ label` para "outro app". Índice único por usuário + app. Check garante os campos certos por modo. `pass_period`: `day/week/month`. |
| `days` | `hours` → **`minutes`**. `unique(user_id, date)`: registrar o mesmo dia de novo edita. |
| `earnings` | `hours` → **`minutes`**. Tem `user_id` próprio (RLS direta, sem join). |
| `expenses` | `+ full_tank` (tanque cheio), necessário para o km/l "tanque a tanque" (insight 5). |
| `maintenance_items` | como no `CLAUDE.md`. |
| `cost_reference` | `age_band`: `0-3`, `4-7`, `8+` anos. Valores em **centavos por km** (`numeric`). `+ is_placeholder`, `+ source_note`. Sem `user_id`: é tabela de referência, só leitura para usuários logados. |
| `payments` | `unique(provider, provider_payment_id)` garante o webhook idempotente. `user_id` vira `null` se a conta for excluída (registro fiscal do pagamento é mantido). |
| `entitlements` | `+ payment_id`, `+ revoked_at`, `+ revoke_reason` (reembolso de 7 dias). Índice garante no máximo um acesso **ativo** por usuário e plano. |

## Segurança (RLS)

- RLS ligada em **todas** as tabelas.
- Dados do motorista: `select/insert/update/delete` só quando `user_id = auth.uid()`.
- `earnings` e `expenses` apontam para `days` por chave composta `(day_id, user_id)`: é impossível pendurar um ganho no dia de outra pessoa, mesmo conhecendo o id.
- `payments` e `entitlements`: usuário só **lê** as próprias linhas. Quem escreve é o servidor com a `service_role` (webhook, admin).
- `cost_reference`: só leitura para usuários logados.
- Usuário anônimo (`anon`) não tem acesso a nenhuma tabela.
- Excluir o usuário em `auth.users` apaga em cascata todos os dados dele.

Testado em `db/rls.test.ts` (roda com `pnpm test`, usando PGlite com um "shim" mínimo do Supabase em `db/test-utils/`, sem precisar de Docker).

## Como aplicar no Supabase

Cada migration é aplicada uma vez, em ordem, com `scripts/supabase-sql.sh` (usa a Management API do Supabase e um *access token* da conta):

```bash
SUPABASE_ACCESS_TOKEN=sbp_... scripts/supabase-sql.sh db/migrations/0001_init.sql
```

Alternativa manual: painel do Supabase → **SQL Editor** → colar o arquivo → Run.

Nunca aplicar `db/test-utils/supabase-shim.sql` no projeto real.

### Histórico de aplicação (projeto `bguifsyabtcvinzaajcy`)

| Data | Arquivo |
|---|---|
| 23/11/2026 | `0001_init.sql`, `seed.sql` |
