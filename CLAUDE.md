# Km+ — contexto do projeto

App web instalável (PWA), em português do Brasil, para motoristas de Uber, 99 e similares. Em ~20 segundos por dia o motorista registra ganhos, horas e km. O app devolve métricas, lucro líquido, simulador de meta e insights.

Produto **pago por compra única** (renda extra do dono). Uma versão gratuita básica + premium virá depois, então o acesso tem que ser controlado por um único ponto (ver "Acesso e pagamento").

Os números nas telas de referência (`/design`) são **exemplos**, não dados reais.

---

## Princípios (valem para qualquer decisão)

1. **Registro rápido.** O motorista abre o app no fim do dia e fecha em ~20 s. Só o ganho é essencial. Horas, km e gastos são opcionais; as métricas que dependem deles aparecem quando houver dado e se escondem com elegância quando não houver.
2. **Tom positivo.** O app nunca desanima. Não mostrar "custo", "prejuízo" ou "depreciação" em destaque. A métrica-herói é **"Sobrou no bolso"**. Custos do veículo existem só no modo opcional e aparecem como **"Reserva do carro"** (proteção, não perda).
3. **Honestidade.** Estimativas são sempre rotuladas como estimativas. Não prometer ganhos. Nunca inventar estatísticas.
4. **Funciona sem sinal.** Offline-first: registrar o dia tem que funcionar sem internet e sincronizar depois.
5. **Bonito e limpo.** Poucos elementos por tela, números grandes, botões fáceis de tocar com uma mão (≥ 44 px).

---

## Decisões já tomadas

- Nome: **Km+** (logo ainda será criada; usar wordmark provisório em texto, fonte Bricolage Grotesque 800).
- Idioma: UI em pt-BR. Código, nomes de variável e commits em inglês. README e docs em português.
- Moeda BRL e datas em pt-BR; fuso `America/Sao_Paulo`. Semana de **segunda a domingo**.
- Valores monetários guardados em **centavos (integer)**. Nunca float.
- Compra única. Preço fica em configuração (`PRICE_BRL_CENTS`), não no código espalhado.
- Sem integração automática com Uber/99, sem leitura de tela, sem overlay. Registro manual.
- Não usar logos ou marcas da Uber/99. Os nomes aparecem só como texto. Rodapé/Termos: "Km+ não é afiliado à Uber nem à 99."

## Stack (padrão; só troque com justificativa curta)

- Next.js (App Router) + TypeScript `strict` + Tailwind CSS
- Supabase: Postgres, Auth (link por e-mail + Google), Row Level Security em todas as tabelas
- PWA: manifest, service worker, ícones; dados locais em IndexedDB (Dexie) com fila de sincronização
- Pagamento: Mercado Pago (Pix + cartão), atrás de uma interface `PaymentProvider` para poder trocar
- Deploy: Vercel. Variáveis em `.env.local`; nunca commitar segredos. Fornecer `.env.example`
- Testes: Vitest (cálculos, 100% das funções puras de `lib/metrics`, `lib/simulator`, `lib/insights`) e Playwright (fluxo principal)
- Gráficos: barras e progresso desenhados com HTML/CSS/SVG simples, sem biblioteca de charts no v1

---

## Modelo de dados (ponto de partida; ajuste se precisar, documentando em `docs/data-model.md`)

Todas as tabelas com `user_id` e RLS (`user_id = auth.uid()`).

- `profiles`: id, display_name, city, vehicle_ownership (`own|rented|financed`), fuel_type (`gasoline|ethanol|flex|gnv|electric`), apps text[] (ex.: uber, 99, nomes livres), monthly_goal_cents, typical_hours_per_day, typical_days_per_month, vehicle_mode_enabled bool, created_at
- `vehicles`: brand, model, year, category (`compact|sedan|suv|other`), km_per_liter null, odometer_km null, rent_cents + rent_period null (se alugado), installment_cents null (se financiado), insurance_year_cents null, ipva_year_cents null
- `platform_settings`: source, mode (`net_already|percent|pass`), percent null, pass_cents + pass_period null. Padrão: `net_already` (o motorista lança o que recebeu). Existe porque a Uber e a 99 estão migrando de % por corrida para passe/assinatura.
- `days`: date (único por user), hours null, km null, is_day_off bool, shifts text[] null (`morning|afternoon|evening|night`), note null
- `earnings`: day_id, source (`uber|99|other`), label null (nome do app quando `other`), amount_cents, hours null (opcional, só quando o motorista divide as horas entre apps)
- `expenses`: day_id, category (`fuel|food|toll|parking|wash|other`), label null, amount_cents, liters null, odometer_km null
- `maintenance_items`: name, interval_km, last_done_km, last_done_date
- `cost_reference` (tabela semente): category, age_band, maintenance_cents_per_km, tires_cents_per_km. **Valores iniciais são placeholders e devem ser marcados como tais**; registrar premissas em `docs/custos.md`. Nunca apresentar como fato.
- `payments`: provider, provider_payment_id, status, amount_cents, paid_at, raw jsonb
- `entitlements`: user_id, plan (`premium|free`), source (`purchase|manual`), granted_at

---

## Regras de cálculo (implementar como funções puras em `lib/`, com testes)

Definições, para um período (dia, semana ou mês):

- `gross` = soma de `earnings.amount`
- `platformFee` = só se configurado em `platform_settings` (percentual sobre o ganho daquele app, ou passe rateado por dia no período). Se `net_already`, é 0.
- `expensesTotal` = soma de `expenses.amount`
- **`net` ("Sobrou no bolso") = gross − platformFee − expensesTotal**
- `grossPerHour` = gross / hours (Painel: "Ganho por hora")
- `grossPerKm` = gross / km (Painel: "Ganho por km")
- `netPerHour` = net / hours (base do Simulador)
- Se hours ou km faltarem, não dividir: omitir a métrica.
- Comparativo Uber × 99 por hora: só usa dias em que o motorista informou horas por app (`earnings.hours`). Sem isso, mostrar apenas a **participação de cada app no ganho (R$ e %)**.
- Meta do mês: progresso = net do mês / meta. "Faltam R$ X · cerca de R$ Y por dia nos N dias restantes" (dias restantes inclui hoje).

**Modo veículo (opcional)** — `reserve` ("Reserva do carro") e `freeAfterReserve = net − reserve`:
- Por km: `maintenance + tires` (de `cost_reference` pela categoria e idade do carro) + (seguro anual + IPVA anual) / km rodados no ano estimado
- Alugado: aluguel rateado por dia. Financiado: parcela rateada por dia. Próprio: sem esse item.
- Refinar com os dados reais: se o motorista lançar manutenção (despesa `other` com label de manutenção) ou preencher valores do carro, usar o dado dele no lugar da referência.
- Sempre exibir "estimativa" e permitir editar os valores.

**Simulador** (`lib/simulator`):
- Entradas: meta líquida mensal (`target`), horas por dia (`hoursPerDay`), dias por mês (`daysPerMonth`)
- Base histórica: `baseNetPerHour` = net / hours dos últimos 90 dias (somente dias com horas). Sem histórico suficiente (< 7 dias com horas), usar os valores do onboarding e avisar.
- Saídas: `perDay = target / daysPerMonth`; `perHour = target / (hoursPerDay * daysPerMonth)`; `% acima do ritmo = perHour / baseNetPerHour − 1`
- Caminhos (constantes configuráveis, padrão 20% e +2 dias):
  1. só mais horas: `target / baseNetPerHour / daysPerMonth` horas por dia
  2. +20% no ganho/hora: `target / (base * 1.2) / daysPerMonth`
  3. +20% e +2 dias: `target / (base * 1.2) / (daysPerMonth + 2)`
  4. "meio do caminho": meta intermediária = (média atual + target) / 2 e as horas por dia para ela
- Se algum caminho passar de 12 h/dia, mostrar o aviso discreto "carga alta: dá para fazer melhor". Formato de horas: `10h15`.

**Insights** (`lib/insights`, regras simples, sem IA no v1; cada regra com limiar e teste):
1. Melhor dia/turno: precisa de ≥ 3 semanas e ≥ 2 amostras por dia; mostrar se a diferença de `netPerHour` for ≥ 15%. (Turnos vêm do campo opcional `shifts`.)
2. Comparativo entre apps (conforme a regra acima).
3. Manutenção: soma dos km desde `last_done_km`; avisar quando faltar ≤ 15% do intervalo ou ≤ 800 km.
4. Reserva do carro: "separe cerca de R$ X por dia rodado" (só com modo veículo ligado).
5. Consumo: km/l por abastecimento (tanque a tanque, exige odômetro); avisar se piorar > 10% frente à média de 30 dias.
6. Resumo da semana em texto simples, montado por modelo de frase, com variação vs. semana anterior.
7. **Descanso (cuidado):** só quando houver ≥ 6 dias seguidos rodando. **Uma linha curta**, tom leve, no fim da lista, sem cor de alerta, no máximo 1 vez por semana, com opção de dispensar.

---

## Telas

Referência visual em `/design` (imagens exportadas do protótipo). Navegação por abas fixas: **Registrar · Painel · Simulador · Insights**. "Lucro líquido" abre pelo link no cartão do Painel.

1. **Registrar o dia**: campos Uber, 99 e "Outro app" (com nome livre; permitir mais de um "outro"), horas rodadas, km rodados. "Gastos do dia" como chips opcionais (Combustível, Alimentação, Pedágio, Outro, + estacionamento/lavagem); toque abre valor. Combustível aceita litros e odômetro opcionais. Opcionais extras, recolhidos por padrão: turnos (manhã/tarde/noite/madrugada), "dividir horas entre apps", marcar **dia de folga**. O cartão "Sobrou no bolso hoje" atualiza enquanto digita. Botão "Fechar o dia". Registrar o mesmo dia duas vezes edita o dia.
2. **Painel**: seletor Hoje/Semana/Mês; cartão-herói "Sobrou no bolso", com selo de variação vs. período anterior e mini barras por dia (melhor dia destacado); ganho por hora e por km; Uber × 99; meta do mês; link para Lucro líquido.
3. **Lucro líquido**: cartão-herói com o valor do mês e a barra de quanto do ganho ficou; lista ganhos → gastos → "Sobrou no bolso"; bloco "Modo veículo" (interruptor) com Reserva do carro e "Livre depois da reserva".
4. **Simulador**: "Hoje você sobra" (histórico) × "Quero chegar a"; horas por dia e dias por mês; resultado por dia e por hora; 3 caminhos + meio do caminho. Aviso: "Estimativa baseada no seu histórico, não é garantia de ganho."
5. **Insights**: resumo da semana + cartões de insight conforme as regras.

Telas **não mockadas** (seguir a mesma linguagem visual e me mostrar antes de refinar): login, onboarding, ajustes/perfil (acesso pelo ícone no topo do Painel), compra/paywall, termos e privacidade.

**Onboarding adaptativo** (rápido, 1 pergunta por tela, pode pular): apps que usa; carro **próprio, alugado ou financiado** (alugado pede valor e periodicidade; financiado pede parcela); combustível; meta mensal; dias por semana e horas por dia típicas. O app se adapta às respostas.

Estados vazios amigáveis (ex.: "Registre seu primeiro dia para ver o painel"), loading com esqueleto, erro com ação clara.

---

## Design system (tokens)

Cores:
- `bg` #F4F3EE · `surface` #FFFFFF · `border` #E6E3DA · `divider` #EEEBE3
- `ink` #101828 · `muted` #5B6472
- `lime` #C6F135 (**sempre como fundo de cartão com texto `ink`; nunca texto lime sobre fundo claro**)
- `lime-text` #26340A (textos secundários sobre lime) · `lime-bar` #5C7A14 (barras sobre lime) · trilho de barra sobre lime: `rgba(16,24,40,.2)`
- `grey-bar` #7C8798 · `track` #EEEBE3 (trilho sobre branco) · `segment-bg` #E9E7DF
- Contraste mínimo 4,5:1 para texto; cor nunca é a única informação.

Tipografia:
- Números e títulos: **Bricolage Grotesque** 700/800, `letter-spacing` −0.03 a −0.035em
- Texto: **Manrope** 500–800
- Valor-herói: "R$" 26 px / inteiro 60–64 px / centavos 32–34 px (mesma linha, alinhados pela base)
- Rótulos em caixa-alta: 12 px, 700–800, `letter-spacing` .06em

Forma e espaço:
- Coluna de 390 px como base; no desktop, coluna central de até 480 px
- Raios: cartão 20 · herói 28 · botão 16 · chip 22 · seletor 16/12
- Cartões brancos com borda `border`, sem sombra. Espaço entre cartões 12 px
- Barra de abas: 76 px; aba ativa = pílula `ink` 56×30 com ícone branco + rótulo `ink`; inativas `muted`
- Botão primário: fundo `ink`, texto `lime`. Cartão-herói: fundo `lime`, texto `ink`
- Valores monetários sem vermelho. Sem emoji na interface. Ícones de traço (stroke 2), 20–22 px

---

## Acesso e pagamento (compra única)

- Cadastro e login livres; o **uso** exige compra. Sem compra, o usuário vê a tela de compra (com preço, o que inclui, garantia).
- Fluxo: usuário clica comprar → Checkout do Mercado Pago (Pix/cartão) → **webhook** confirma o pagamento (validar assinatura; consultar o pagamento na API do provedor, nunca confiar no retorno do navegador) → grava em `payments` e cria `entitlements(plan='premium')`.
- **Todas** as checagens de acesso passam por `lib/entitlements.ts` (`can(user, feature)`), para que o futuro plano gratuito seja só mudar regras ali.
- Webhook idempotente. Reembolso em até 7 dias (direito de arrependimento do CDC) deve estar previsto: ação manual de revogar o entitlement.
- Teste com credenciais sandbox; documentar em `docs/pagamentos.md` como o dono do app configura o Mercado Pago.

## Segurança, privacidade e legal

- RLS em tudo, testada. Nenhuma chave secreta no cliente. Validar entradas no servidor (zod).
- LGPD: política de privacidade, termos de uso, **exportar meus dados (CSV)** e **excluir minha conta** dentro do app. Coletar o mínimo.
- Avisos: "Estimativas não garantem ganhos"; "Não é aconselhamento financeiro/tributário"; "Km+ não é afiliado à Uber nem à 99".
- Os textos jurídicos finais serão revisados por um advogado; gerar rascunhos claros em `legal/` marcados como RASCUNHO.

## Convenções de código

- Estrutura: `app/` (rotas), `components/`, `lib/` (metrics, simulator, insights, money, dates, entitlements, payments), `db/` (migrations, seed), `docs/`, `design/`, `legal/`
- Funções de cálculo puras, sem I/O, com testes por tabela de casos (inclua os exemplos numéricos da seção abaixo)
- Componentes pequenos; sem estilos inline soltos: tokens no `tailwind.config`
- Acessibilidade: `button`/`a`/`input`+`label` reais, foco visível, `aria-live` no resultado do cartão "Sobrou no bolso"
- Scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `e2e`. Rodar lint + typecheck + test antes de cada commit
- Commits pequenos e frequentes, mensagem no imperativo em inglês

### Exemplos numéricos para testes (conferem com as telas de referência)
- Dia: ganhos 212,50 + 98,00 + 40,00 = 350,50; gastos 85,00 + 22,00 = 107,00 → net 243,50; 8,5 h → ganho/hora 41,24; 142 km → ganho/km 2,47
- Semana: ganhos 2.140,00; gastos 612,00 → net 1.528,00; 52 h → 41,15/h; 880 km → 2,43/km
- Mês: ganhos 8.940,00; gastos 2.540,00 → net 6.400,00 (71,6%); reserva 1.320,00 → livre 5.080,00
- Simulador: base 6.000 em 192 h = 31,25/h; meta 10.000 com 8 h × 24 dias → 416,67/dia, 52,08/h (67% acima); caminhos 13h20 · 11h07 · 10h15 por dia

## Fora do escopo do v1

Integração automática com Uber/99, leitura de tela ou overlay durante corridas, app nativo nas lojas, IA generativa, ranking/social, múltiplos veículos, assinatura recorrente.
