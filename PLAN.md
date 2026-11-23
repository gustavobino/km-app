# Km+ — Plano de construção (v1)

Fonte da verdade: `CLAUDE.md`. Referência visual: `design/project/*.dc.html` (código-fonte das 5 telas do protótipo, baixado do canvas; mais preciso que imagens). Decisões pequenas ficam em `docs/decisoes.md`.

## Como cada marco é fechado

1. Implementar → 2. testes do marco → 3. `pnpm lint && pnpm typecheck && pnpm test` verdes → 4. conferir a tela em 390 px e em desktop (coluna ≤ 480 px) com screenshot Playwright lado a lado com a referência → 5. commit(s) pequenos em inglês → 6. resumo de 3–5 linhas para você (pronto / o que preciso de você).

Gerenciador de pacotes: **pnpm**. Node 22.

---

## M0 · Base

**Entrega**
- Next.js (App Router) + TypeScript `strict` + Tailwind; ESLint + Prettier.
- `tailwind.config` com todos os tokens do design system (cores, raios, tipografia, espaçamentos); Bricolage Grotesque e Manrope via `next/font` (self-hosted, funciona offline).
- Componentes-base: `Card`, `HeroCard`, `Money` (R$ / inteiro / centavos alinhados pela base), `Button`, `Chip`, `Segmented`, `TabBar`, `Switch`, `Field`, `Skeleton`, `EmptyState`.
- `lib/money` (centavos ↔ texto pt-BR, parse de "212,50"), `lib/dates` (fuso `America/Sao_Paulo`, semana seg–dom, dias restantes do mês).
- PWA: `manifest.webmanifest`, ícones provisórios (wordmark "Km+"), service worker (Serwist) com cache do app shell.
- Supabase: `db/migrations/0001_init.sql` com todas as tabelas do modelo de dados, constraints, índices e **RLS** em todas; `db/seed.sql` com `cost_reference` placeholder.
- `.env.example`, scripts `dev`, `build`, `lint`, `typecheck`, `test`, `e2e`; `docs/data-model.md`, `docs/custos.md` (placeholders).

**Testes**: Vitest de `lib/money` e `lib/dates`; teste de RLS contra Postgres local (Supabase CLI/Docker) provando que usuário A não lê/escreve dados de B; build passa.

## M1 · Conta e onboarding

**Entrega**
- Login por link mágico (e-mail) e Google (Supabase Auth); callback, sessão via `@supabase/ssr`, middleware protegendo rotas.
- Onboarding adaptativo, 1 pergunta por tela, todas puláveis: apps → carro (próprio / alugado → valor + periodicidade / financiado → parcela) → combustível → meta mensal → dias por semana + horas por dia. Grava `profiles`, `vehicles`, `platform_settings` (padrão `net_already`).
- Telas de login e onboarding na mesma linguagem visual — **mostro para você antes de refinar**.

**Testes**: zod dos formulários; lógica de "próxima pergunta" (pura, com tabela de casos); Playwright do onboarding com auth mockada.

## M2 · Registrar o dia (offline-first)

**Entrega**
- Tela conforme `design/project/Main.dc.html`: Uber, 99, "Outro app" (nome livre, vários), horas, km; chips de gastos (Combustível, Alimentação, Pedágio, Outro + Estacionamento, Lavagem) que abrem valor; combustível com litros e odômetro opcionais.
- Opcionais recolhidos: turnos, dividir horas entre apps, dia de folga.
- Cartão "Sobrou no bolso hoje" ao vivo com `aria-live`; "Fechar o dia"; reabrir um dia já registrado = editar.
- Dexie (IndexedDB) como fonte local + fila de sincronização (outbox) com upsert idempotente no Supabase (`client_id` UUID gerado no aparelho; `updated_at` para "último ganha").

**Testes**: cálculo do dia (exemplo do `CLAUDE.md`: 350,50 − 107,00 = 243,50; 41,24/h; 2,47/km); fila de sync (unidade, com fake IndexedDB): offline → online, repetição, conflito; Playwright: registrar offline, voltar online, conferir no servidor.

## M3 · Métricas e Painel

**Entrega**
- `lib/metrics` puro: `gross`, `platformFee` (percentual por app; passe rateado por dia), `expensesTotal`, `net`, `grossPerHour`, `grossPerKm`, `netPerHour`, omissão quando falta horas/km, variação vs. período anterior, barras por dia com melhor dia, participação por app (R$ e %), comparativo por hora só com `earnings.hours`, meta do mês.
- Painel conforme `Painel.dc.html`: Hoje/Semana/Mês, herói com selo de variação e mini barras, ganho por hora e por km, Uber × 99, meta do mês, link para Lucro líquido, ícone de ajustes no topo. Estados vazio e esqueleto.

**Testes**: 100% de `lib/metrics`, com os exemplos de dia, semana (1.528,00; 41,15/h; 2,43/km) e mês (6.400,00; 71,6%), meta (80%, faltam 1.600, ≈ 229/dia em 7 dias).

## M4 · Lucro líquido e modo veículo

**Entrega**
- `lib/metrics/vehicle` puro: reserva por km (manutenção + pneus da `cost_reference` por categoria/idade + (seguro + IPVA)/km anual estimado), aluguel/parcela rateados por dia, substituição pelos dados reais do motorista quando houver.
- Tela conforme `Lucro.dc.html`: herói do mês + barra, ganhos → gastos por categoria → "Sobrou no bolso", interruptor do modo veículo, "Reserva do carro" rotulada como **estimativa** e editável, "Livre depois da reserva".

**Testes**: exemplo do mês (reserva 1.320,00 → livre 5.080,00); cada fonte de custo isolada; uso do dado real no lugar da referência.

## M5 · Simulador

**Entrega**
- `lib/simulator` puro: base dos últimos 90 dias com horas (fallback para onboarding se < 7 dias, com aviso), por dia, por hora, % acima do ritmo, 3 caminhos + meio do caminho, aviso de carga alta > 12 h, formato `10h15`. Constantes (20 %, +2 dias) configuráveis.
- Tela conforme `Simulador.dc.html` com o aviso "Estimativa baseada no seu histórico, não é garantia de ganho."

**Testes**: 100%; exemplo do `CLAUDE.md` (31,25/h; 416,67/dia; 52,08/h; 67 %; 13h20 · 11h07 · 10h15; meio do caminho 8.000 → 10h40).

## M6 · Insights

**Entrega**
- `lib/insights` puro, uma função por regra com limiar explícito: melhor dia/turno, comparativo entre apps, manutenção, reserva por dia rodado, consumo tanque a tanque, resumo da semana por modelo de frase, descanso (≥ 6 dias seguidos, 1×/semana, dispensável).
- Cadastro mínimo de itens de manutenção (em Ajustes) para alimentar a regra 3.
- Tela conforme `Insights.dc.html`; descanso como linha discreta no fim, sem cor de alerta.

**Testes**: cada regra com casos abaixo/no/acima do limiar; 100% de `lib/insights`.

## M7 · Compra única

**Entrega**
- `lib/entitlements.ts` com `can(user, feature)` como único ponto de checagem (servidor e cliente); middleware redireciona para a tela de compra sem entitlement.
- `lib/payments` com interface `PaymentProvider` e implementação Mercado Pago (Checkout Pro: Pix + cartão), preço em `PRICE_BRL_CENTS`.
- `POST /api/webhooks/mercadopago`: valida assinatura `x-signature`, consulta o pagamento na API, idempotente por `provider_payment_id`, grava `payments` e `entitlements`. Reembolso/chargeback revoga.
- Tela de compra (preço, o que inclui, garantia de 7 dias) — **mostro antes de refinar**.
- `/admin` mínimo (restrito por `ADMIN_EMAILS`): buscar usuário, dar/revogar acesso, ver pagamentos.
- `docs/pagamentos.md`: passo a passo para configurar o Mercado Pago.

**Testes**: `can()` por tabela; webhook com assinatura válida/inválida, evento repetido, pagamento pendente/aprovado/estornado (API do MP mockada); teste manual no sandbox.

## M8 · Conta e legal

**Entrega**
- Ajustes/perfil (ícone no topo do Painel): dados do perfil e do carro, apps e taxas de plataforma, meta, itens de manutenção, sair.
- Exportar meus dados (CSV, um ZIP ou um CSV por tabela) e excluir minha conta (apaga dados e usuário via rota de servidor com service role, com confirmação).
- `legal/termos.md` e `legal/privacidade.md` marcados **RASCUNHO**, páginas `/termos` e `/privacidade`; avisos de não afiliação, "não é aconselhamento financeiro/tributário", "estimativas não garantem ganhos".

**Testes**: geração de CSV (pura); exclusão de conta apaga tudo (teste de integração no Postgres local); Playwright de exportar.

## M9 · Acabamento e lançamento

**Entrega**
- Acessibilidade com `@axe-core/playwright` em todas as telas (zero violações sérias), foco visível, alvos ≥ 44 px, contraste.
- Desempenho: Lighthouse mobile (meta ≥ 90 em performance/PWA/acessibilidade), bundle enxuto.
- Playwright do fluxo principal: login → onboarding → compra (mock) → registrar → painel → simulador → insights.
- Deploy na Vercel (preview + produção) e `docs/lancamento.md` (checklist: variáveis, domínio, Supabase prod, MP produção, revisão jurídica, ícones/logo finais).

**Testes**: suíte e2e completa verde contra o build de produção.

---

## Divergências já notadas entre a referência e o `CLAUDE.md` (sigo o `CLAUDE.md`)

- O canvas se chama "Fechou"; o produto é **Km+**.
- Painel mostra "Uber × 99, por hora" sempre; pelo `CLAUDE.md` isso só aparece com horas por app, senão mostra participação no ganho (R$ e %).
- A referência usa 3 cores fora dos tokens (`#EAE8E0` fundo de ícone de app, `#CFCCC0` borda de chip, `#3D4654` texto de nota). Vou adicioná-las como tokens nomeados (detalhe em `docs/decisoes.md`).
- O herói da tela Registrar tem raio 22 e a meta do Painel 24 (tokens dizem herói 28 / cartão 20). Mantenho como na referência e registro como tokens `radius-hero-sm`.
- A referência não mostra o aviso de estimativa no Simulador nem o selo "estimativa" na Reserva do carro; serão adicionados.
