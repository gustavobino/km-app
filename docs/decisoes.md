# Decisões pequenas (tomadas sem bloquear)

Formato: decisão · motivo. Revise e me avise se quiser mudar alguma.

## Respostas do dono (23/11/2026)
- Repositório: `gustavobino/km-app` (privado).
- Supabase: projeto `bguifsyabtcvinzaajcy`. A região não pode ser trocada depois de criado; segue como está (só afeta latência, não funcionalidade).
- Supabase configurado por API (o dono passou um access token pelo formulário seguro do ambiente): tabelas criadas, Redirect URL `http://localhost:3000/**` liberada. O app usa a chave **publishable** (`sb_publishable_…`), o formato novo de chave pública do Supabase, no lugar da "anon" antiga.
- Login com Google: **depois**. M1 entrega só link por e-mail.
- Preço: **R$ 17,90** (`PRICE_BRL_CENTS=1790`). Conta do Mercado Pago de **pessoa física**.
- Responsável pelos dados (LGPD) nos Termos/Privacidade: o dono, **pessoa física**. E-mail público de contato: pendente (pedir no M8).

## Ferramentas
- **pnpm** como gerenciador de pacotes · rápido, lockfile estável, suportado pela Vercel.
- **Next.js 16** (versão atual). Nele o antigo `middleware.ts` se chama `proxy.ts`. `cacheComponents` desligado · as telas leem dados locais (IndexedDB) no cliente; o cache de componentes do servidor não ajuda e complica a autenticação.
- **Tailwind 4**: os tokens ficam em `app/globals.css` dentro de `@theme` (o Tailwind 4 substituiu o `tailwind.config` por configuração no CSS). Continua sendo um único lugar para todos os tokens, e a paleta padrão do Tailwind foi desligada: só existem as cores do Km+.
- **Service worker escrito à mão** (`public/sw.js`, ~100 linhas) em vez do Serwist · o Serwist depende de plugin de build que ainda não acompanha bem o Turbopack; o nosso caso (cache do app shell + fallback offline) é simples.
- Testes de banco/RLS em **PGlite** (Postgres em WebAssembly) com um "shim" mínimo do Supabase · roda em `pnpm test` sem Docker. Antes do lançamento, conferir também no projeto real.
- Playwright usa o Chromium indicado em `PW_CHROMIUM_PATH` quando definido (útil em contêineres); sem ele, usa o padrão do Playwright.
- Fontes via **`next/font/google`** (self-hosted no build) · funcionam offline e sem CLS.
- Validação com **zod** no cliente e no servidor, mesmos schemas em `lib/schemas`.
- Ícones: SVG próprios de traço (stroke 2), copiados da referência; sem biblioteca de ícones.

## Dados e sincronização
- Cada registro criado no aparelho recebe um **UUID gerado no cliente** · permite upsert idempotente na sincronização.
- Conflito: **último `updated_at` ganha**, por dia · o motorista usa um aparelho; simples e previsível.
- Todas as tabelas ganham `created_at`/`updated_at` e `user_id` (inclusive `earnings` e `expenses`, para RLS direta sem join).
- Primeiro login exige internet; depois disso o app abre e registra offline. O entitlement fica em cache local por até **30 dias** sem revalidar · evita bloquear quem está sem sinal.
- Horas guardadas em **minutos (integer)** e km em integer · mesma lógica de evitar float; a UI mostra `8,5 h` / `8h30`.
- Arredondamento de dinheiro: cálculos em centavos; divisões (por hora, por km, por dia) arredondam **meio para cima** só na exibição.

## Produto / UI
- "Outro app" aceita vários: botão "+ adicionar outro app" abaixo do primeiro.
- Gastos do dia: chips Combustível, Alimentação, Pedágio, Outro visíveis; Estacionamento e Lavagem atrás de "mais".
- Tela Lucro líquido mantém a aba **Painel** ativa (como na referência), com botão voltar.
- Ajustes abrem por ícone de engrenagem no topo do Painel.
- Tokens extras vindos da referência: `app-chip-bg` #EAE8E0, `chip-border` #CFCCC0, `note-text` #3D4654, `lime-divider` rgba(16,24,40,.18), raio `hero-sm` 22–24.
- Wordmark provisório "Km+" em Bricolage Grotesque 800 também nos ícones do PWA (fundo lime, texto ink).
- O PWA abre em `/registrar` (o motorista abre o app para registrar o dia).
- Semana de segunda a domingo: em 23/11/2026 (segunda) a semana é "23 a 29 de novembro". A referência mostra "17 a 23", que não é seg–dom; sigo o `CLAUDE.md`.
- Selo de variação: triângulo para cima/para baixo + texto ("8% a mais", "5% a menos"), sempre em `ink`/`lime`, nunca vermelho.

## Pagamento e acesso
- Mercado Pago **Checkout Pro** (redirecionamento) · já oferece Pix e cartão sem eu tocar em dados de cartão (fora do escopo PCI).
- Admin definido por variável `ADMIN_EMAILS` (lista separada por vírgula) · sem tabela de papéis no v1.
- Reembolso: estorno feito no painel do Mercado Pago; o webhook de `refunded`/`charged_back` revoga o entitlement automaticamente, e o `/admin` permite revogar à mão.

## Custos do veículo
- Valores iniciais de `cost_reference` são **placeholders** (marcados `is_placeholder = true` no banco e em `docs/custos.md`) para você revisar; a UI sempre mostra "estimativa".
- km anual estimado = média de km/dia rodado dos últimos 90 dias × dias típicos por mês × 12; sem histórico, usa 3.000 km/mês (placeholder).

## Login (M1)
- **Link mágico por e-mail** com o e-mail padrão do Supabase (`/auth/callback`, fluxo PKCE). Limitação: o link precisa ser aberto **no mesmo aparelho e navegador** em que foi pedido.
- O plano grátis do Supabase **não deixa personalizar o e-mail** sem um provedor de e-mail próprio (SMTP), e o provedor padrão envia **só 2 e-mails por hora**. Por isso o e-mail sai em inglês ("Sign in").
- Já deixei pronto o modo melhor, que liga com um interruptor (`NEXT_PUBLIC_AUTH_OTP_CODE=true`) assim que houver SMTP: e-mail em português com **código de 6 dígitos** (digitado dentro do app instalado) e link que funciona em qualquer navegador (`/auth/confirm`). Modelo em `db/auth-templates/login.html`; código de 6 dígitos já configurado no Supabase.
- Verificação da sessão com `getClaims()` (chaves assimétricas ES256, verificadas localmente: rápido mesmo com o banco nos EUA).
- Telas do app exigem login (`proxy.ts`) e onboarding concluído (`app/(app)/layout.tsx`). A segurança real continua sendo o RLS.
- Ao sair, o app apaga as páginas guardadas no aparelho (elas contêm dados do motorista).
- O service worker só guarda as telas **depois** do login (nunca guarda a página de redirecionamento).

## Onboarding (M1)
- 5 perguntas (6 se o carro for alugado ou financiado), todas puláveis; "Pular" na última conclui.
- "Dias por semana" vira `typical_days_per_month` = dias × 52 ÷ 12, arredondado (6 → 26).
- Apps escolhidos viram `profiles.apps` e linhas em `platform_settings` no modo padrão `net_already`. Digitar "Uber" ou "99" no campo "Outro app" conta como o app oficial.
- Aluguel/parcela vão para `vehicles` (só se informados). Combustível e meta ficam no perfil.
- Ajustes mínimos (conta, refazer perguntas, sair) já existem; o restante vem no M8.

## Testes ponta a ponta (M1)
- Rodam contra o **Supabase real**: cada teste cria um usuário `e2e-…@example.com`, entra por um link gerado pelo servidor (sem enviar e-mail) e apaga o usuário no fim. A chave secreta é lida de `SUPABASE_SERVICE_ROLE_KEY` ou buscada na hora pela API de gerenciamento; nunca é gravada em arquivo.
- No ambiente na nuvem do Claude, rodar com `NODE_USE_ENV_PROXY=1` (o Node só usa o proxy de rede com essa variável).

## Pendências para o lançamento (vão para `docs/lancamento.md` no M9)
- **Configurar SMTP próprio** (ex.: Resend, Brevo) no Supabase: tira o limite de 2 e-mails/hora e libera o e-mail em português com código. Depois aplicar `db/auth-templates/login.html` e ligar `NEXT_PUBLIC_AUTH_OTP_CODE=true`.
- Adicionar o domínio da Vercel em Supabase → Authentication → URL Configuration.
