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

## Registrar o dia e offline (M2)
- Cada dia fica no aparelho (IndexedDB, via Dexie) como um registro completo, com a marca `dirty` enquanto não foi confirmado pelo servidor. Registrar a mesma data de novo edita o mesmo registro.
- Sincroniza ao abrir o app, quando a internet volta, quando o app volta para a frente da tela e logo após "Fechar o dia". Um pedido feito durante uma sincronização dispara mais uma rodada no fim (para não perder o dia recém-salvo). Não usamos "Background Sync" do navegador: o suporte no iPhone é ruim, e o app sincroniza na próxima abertura.
- Edição feita no aparelho e ainda não enviada nunca é sobrescrita por dados baixados; o servidor decide pela edição mais recente.
- Sem internet, trocar de aba faz um carregamento completo (o service worker entrega a tela guardada). O service worker agora guarda também os arquivos JavaScript/CSS de cada aba.
- Ao sair da conta, o app apaga os dados do aparelho e avisa antes se houver dias não enviados.
- A tela de registro é desenhada só no aparelho: a data de "hoje" vem do celular, porque o HTML pode estar guardado de outro dia.
- Setas no topo permitem registrar dias anteriores (quem roda de madrugada costuma fechar o dia depois da meia-noite). Não dá para ir para o futuro.
- Gastos: um chip por categoria; "Outro" aceita vários, com descrição opcional. Combustível aceita litros, odômetro e "Enchi o tanque" (necessário para o km/l tanque a tanque do insight de consumo).
- Dia de folga: esconde ganhos, horas e km; gastos continuam possíveis. O cartão mostra "Dia de folga" em vez de valor.
- "Dividir horas entre apps": um campo de horas por app; se o total ficar vazio, ele vira a soma.
- Taxa de plataforma no "Sobrou no bolso hoje": percentual por app e passe rateado por dia (`lib/metrics/core.ts`). Com o padrão `net_already`, é zero.
- Métricas por hora/km de um período usam só os dias que informaram horas/km (para um dia sem horas não inflar o ganho por hora).
- Anotação livre (`days.note`) existe no banco mas não aparece na tela (menos campos = registro mais rápido).

## Painel (M3)
- **Comparação justa:** a variação compara o mesmo trecho do período anterior (quarta-feira: seg–qua desta semana × seg–qua da passada; dia 23: 1–23 deste mês × 1–23 do anterior). Comparar com o período anterior inteiro faria todo começo de semana parecer queda.
- Selo de variação: triângulo para cima ou para baixo e o número, sempre em ink/lime (nunca vermelho). Sem período anterior com valor, o selo não aparece.
- Barras: na Semana, uma por dia (Seg…Dom); no Mês, uma por semana (S1…S6, semanas de segunda a domingo cortadas no mês); em Hoje, sem barras. O melhor período fica em ink. Dias futuros ficam vazios.
- Passe de app (modo `pass`) é rateado só pelos dias que já passaram no período.
- Uber × 99 por hora só com horas por app (de pelo menos dois apps); senão o cartão vira "Quanto veio de cada app" (R$ e %) com a dica de usar "Dividir horas entre apps". Com um app só, o cartão some.
- Sem horas e km no período, os cartões de ganho por hora/km dão lugar a uma dica curta.
- Meta do mês sempre usa o mês, qualquer que seja a aba escolhida; some se não houver meta. Meta batida: "Meta batida! Você passou da meta em R$ X." O percentual é arredondado para baixo (não mostra 100% antes de bater).
- A aba escolhida (Hoje/Semana/Mês) fica lembrada no aparelho.
- A sincronização roda em qualquer aba do app (provider no layout), não só no Registrar.
- Telas que leem dados do aparelho são desenhadas só no navegador com `ClientOnly` (e não com `next/dynamic` sem SSR): assim o código vai junto com a página e o service worker guarda tudo para uso sem internet. Um teste de ponta a ponta pegou essa regressão.

## Lucro líquido e modo veículo (M4)
- Lucro líquido mostra o **mês atual**: herói com o valor e a barra de "quanto do ganho ficou", depois ganhos → taxas dos apps (se houver) → gastos por categoria → "Sobrou no bolso".
- Modo veículo desligado por padrão; o interruptor grava no perfil (precisa de internet; sem sinal, volta à posição anterior e avisa).
- Reserva do carro = R$ por km × km do mês + aluguel/parcela rateados pelos dias já vividos do mês. Sempre com a etiqueta **"estimativa"** e "Não é aconselhamento financeiro".
- Prioridade dos valores por km: o que o motorista digitou > o histórico dele de manutenção (gastos "Outro" com descrição tipo "óleo", "revisão", "freio"…, a partir de 1.000 km nos últimos 90 dias) > tabela de referência (placeholder). Quando a referência provisória é usada, a tela diz isso.
- Seguro e IPVA anuais são divididos pelos km estimados no ano: média de km por dia rodado (últimos 90 dias) × dias típicos por mês (onboarding; 22 se vazio) × 12. Sem histórico: 3.000 km/mês (placeholder).
- "Editar valores" abre uma gaveta com tudo opcional: tipo de posse, marca, modelo, ano, tipo de carro, aluguel/parcela, seguro, IPVA, manutenção e pneus por km.

## Simulador (M5)
- Base = sobra líquida por hora nos últimos 90 dias, **só dias com horas** (taxas e gastos descontados). Constantes em `lib/simulator` (`SIMULATOR`): janela 90 dias, mínimo 7 dias, +20% por hora, +2 dias, carga alta acima de 12 h.
- "Sem histórico suficiente, usar os valores do onboarding": interpretado assim — os campos já vêm preenchidos com a meta, as horas por dia e os dias por mês do onboarding; com menos de 7 dias com horas, a base usa o que existe e a tela avisa "Ainda com pouco histórico"; sem nenhum dia com horas, a tela mostra só quanto sobrar por dia e por hora e pede para registrar horas (não dá para inventar um ganho por hora).
- "Hoje você sobra" = base por hora × horas por dia × dias por mês da rotina atual (onboarding; se vazio, média do histórico / 22 dias). É a "média atual" usada no "meio do caminho". Exemplo do `CLAUDE.md`: 31,25 × 8 × 24 = R$ 6.000.
- Meta abaixo do ritmo atual: mostra "abaixo do seu ritmo atual" e não mostra o meio do caminho.
- O aviso de carga alta troca o subtítulo do caminho (discreto, sem cor de alerta). O destaque lime fica no caminho 3, a menos que ele mesmo passe de 12 h.

## Insights (M6)
Regras em `lib/insights` (limiares em `INSIGHTS`), cada uma com testes abaixo/no/acima do limiar:
1. **Melhor dia / turno:** ≥ 3 semanas desde o primeiro dia com horas, ≥ 2 dias com horas em pelo menos dois grupos, vantagem de sobra por hora ≥ 15% sobre a média (somada) dos outros grupos. Texto "Cerca de X%" arredondado de 5 em 5. Dia e turno aparecem como cartões separados. Um dia com vários turnos conta para cada um deles (aproximação; documentada aqui).
2. **Apps:** semana atual; por hora só com horas por app, senão "X trouxe a maior parte" com a dica de dividir as horas.
3. **Manutenção:** km rodados desde a última vez = odômetro mais recente (dos abastecimentos) − km da última vez; sem odômetro, soma dos km dos dias depois da data. Aviso com ≤ 15% do intervalo **ou** ≤ 800 km. Passou do ponto: "Já passou cerca de X km do previsto. Vale agendar." Cadastro mínimo de itens em Ajustes (sugestões: troca de óleo, rodízio de pneus, revisão).
4. **Reserva:** só com modo veículo ligado; reserva do mês ÷ dias rodados.
5. **Consumo:** km/l tanque a tanque (entre dois "tanque cheio", somando abastecimentos parciais no meio). Avisa se o último ficar > 10% pior que a média dos anteriores dos últimos 30 dias.
6. **Resumo da semana:** frase-modelo com o valor, a variação contra o mesmo trecho da semana passada (sem desanimar: "Semana que vem tem mais") e o melhor dia.
7. **Descanso:** ≥ 6 dias seguidos rodando (terminando hoje ou ontem). Uma linha discreta no fim, sem cor de alerta, com "Dispensar" (fica dispensado até a semana seguinte, guardado no aparelho).
- Comparações no limite exato (ex.: 15,0%) contam como atingidas (tolerância de ponto flutuante).
