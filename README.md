# Km+

App web instalável (PWA) para motoristas de Uber, 99 e similares: registre o dia em ~20 segundos e veja quanto sobrou no bolso.

- Produto e regras: [`CLAUDE.md`](CLAUDE.md)
- Plano por marcos: [`PLAN.md`](PLAN.md)
- Decisões: [`docs/decisoes.md`](docs/decisoes.md) · Modelo de dados: [`docs/data-model.md`](docs/data-model.md) · Custos (placeholders): [`docs/custos.md`](docs/custos.md)
- Telas de referência: `design/project/*.dc.html` (abra no navegador)

## Rodando localmente

Requisitos: Node 22 e pnpm 10.

```bash
pnpm install
```

```bash
cp .env.example .env.local
```

```bash
pnpm dev
```

Abra http://localhost:3000. Em desenvolvimento, `/dev/componentes` mostra os componentes-base com os números de exemplo (a página não existe em produção).

## Scripts

| Script | O que faz |
|---|---|
| `pnpm dev` | servidor de desenvolvimento |
| `pnpm build` / `pnpm start` | build e servidor de produção |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | gera os tipos das rotas e roda o TypeScript |
| `pnpm test` | Vitest (cálculos + banco/RLS em PGlite) |
| `pnpm test:coverage` | idem, com cobertura (100% exigido em `lib/metrics`, `lib/simulator`, `lib/insights`) |
| `pnpm e2e` | Playwright (faz o build e sobe o servidor sozinho; usa o Supabase real e precisa de `SUPABASE_SERVICE_ROLE_KEY`) |
| `pnpm check` | lint + typecheck + test (rodar antes de cada commit) |

## Estrutura

```
app/          rotas (App Router); (app)/ = telas com barra de abas
components/   ui/ (Card, Chip, Money…), layout/ (Screen, TabBar), pwa/
lib/          money, units, dates, metrics, simulator, insights, entitlements, payments
db/           migrations/, seed.sql, testes de RLS
e2e/          testes Playwright
docs/ legal/ design/
public/       sw.js (service worker) e ícones
```
