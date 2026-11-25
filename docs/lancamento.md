# Checklist de lançamento do Km+

Marque cada item ao concluir. Itens com **(você)** dependem do dono do app; os outros eu (Claude) faço ou já fiz.

## 1. Publicar na Vercel (você, ~10 min) — feito em 24/11/2026: https://km-app-three.vercel.app

1. Crie uma conta em https://vercel.com usando **"Continue with GitHub"** (a mesma conta do repositório `gustavobino/km-app`).
2. No painel da Vercel: **Add New… → Project** → em "Import Git Repository", escolha **km-app** (se não aparecer, clique em "Adjust GitHub App Permissions" e libere o repositório).
3. Framework: **Next.js** (detectado sozinho). Não mude Build/Output/Install.
4. Abra **Environment Variables** e cadastre (marque Production, Preview e Development):

| Nome | Valor | Onde pegar |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://bguifsyabtcvinzaajcy.supabase.co` | — |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave que começa com `sb_publishable_` | Supabase → Project Settings → API Keys → Publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | chave que começa com `sb_secret_` (**secreta**) | Supabase → Project Settings → API Keys → Secret keys |
| `PRICE_BRL_CENTS` | `1790` | — |
| `MERCADOPAGO_ACCESS_TOKEN` | token de **teste** por enquanto (**secreto**) | Mercado Pago → sua aplicação → Credenciais de teste |
| `MERCADOPAGO_WEBHOOK_SECRET` | deixe em branco agora; preencha no passo 3 | — |
| `ADMIN_EMAILS` | seu e-mail de login no Km+ | — |
| `LEGAL_CONTROLLER_NAME` | seu nome completo | aparece nos Termos e na Privacidade |
| `NEXT_PUBLIC_CONTACT_EMAIL` | e-mail público para suporte e LGPD | idem |
| `NEXT_PUBLIC_SITE_URL` | deixe para depois do primeiro deploy | — |

5. Clique em **Deploy**. Quando terminar, copie o endereço (ex.: `https://km-app-xxxx.vercel.app`).
6. Volte em **Settings → Environment Variables**, cadastre `NEXT_PUBLIC_SITE_URL` com esse endereço e faça **Redeploy** (Deployments → ⋯ → Redeploy).
7. Me mande o endereço. **Não mande chaves pelo chat.**

## 2. Supabase aponta para o endereço novo (eu)

- [x] Authentication → URL Configuration: Site URL = `https://km-app-three.vercel.app`; Redirect URLs += `https://km-app-three.vercel.app/**` (24/11/2026).
- [x] Teste no site publicado (`e2e/producao.spec.ts`): login, onboarding, compra até o Mercado Pago, registro do dia.
- [x] Link de login aberto em outro navegador/aparelho funciona no site publicado (correção de 24/11/2026).

## 3. Webhook do Mercado Pago (você, ~3 min) — feito em 24/11/2026 (o site recusa avisos sem assinatura: segredo configurado)

1. Mercado Pago → sua aplicação → **Webhooks → Configurar notificações** (modo de teste).
2. URL: `https://SEU-ENDERECO/api/webhooks/mercadopago`. Evento: **Pagamentos**. Salve.
3. Copie a **assinatura secreta** e cole na Vercel em `MERCADOPAGO_WEBHOOK_SECRET`. Redeploy.

## 4. Teste completo em produção (nós dois)

- [ ] Abrir no celular, "Adicionar à tela inicial", entrar por e-mail (no **mesmo** navegador).
- [ ] Responder o onboarding, comprar com o **cartão de teste APRO** (aparece no painel do Mercado Pago) e ver o app liberar sozinho.
- [ ] Registrar um dia sem internet (modo avião) e ver sincronizar ao voltar.
- [ ] Estornar o pagamento de teste no Mercado Pago e ver o acesso ser revogado.
- [ ] `/admin`: dar e revogar acesso de um usuário.

## 5. Antes de abrir para o público

- [x] **Migrar da Vercel para o Cloudflare** — feito em 24/11/2026: Worker `km-app`, domínio `kmmais.app.br` (nameservers do Registro.br apontando para o Cloudflare; registros do Resend como "DNS only"). Teste completo passou no domínio. Supabase: Site URL = `https://kmmais.app.br`.
- [ ] **Backup semanal gratuito** do banco Supabase. (eu)

- [x] **E-mail próprio (SMTP)** — feito em 24/11/2026: domínio `kmmais.app.br` (Registro.br) verificado no Resend, Supabase enviando como `Km+ <nao-responda@kmmais.app.br>`, limite 30/h, modelo em português com código aplicado. Falta só `NEXT_PUBLIC_AUTH_OTP_CODE=true` na Vercel.
- [x] **Domínio próprio** `kmmais.app.br` no Cloudflare (24/11/2026). Falta (você): trocar a URL do webhook no Mercado Pago para `https://kmmais.app.br/api/webhooks/mercadopago`.
- [x] **Revisão jurídica** de `legal/termos.md` e `legal/privacidade.md` — feita (24/11/2026); marca RASCUNHO removida. Fornecedores atualizados: Cloudflare (hospedagem) e Resend (e-mail).
- [ ] **Custos de referência** em `docs/custos.md`: revisar os placeholders e marcar `is_placeholder = false`. (você)
- [x] **Mercado Pago produção** (24/11/2026): credenciais de produção no Cloudflare (checkout criado na conta real), webhook de produção em `https://kmmais.app.br/api/webhooks/mercadopago` com assinatura nova (simulação respondeu 200). Ainda vale renovar o token de teste que foi colado no chat.
- [ ] **Compra real** de R$ 17,90 e estorno, para conferir.
- [x] **Logo e ícones:** o dono decidiu manter o wordmark "Km+" atual no lançamento (24/11/2026).
- [ ] Supabase em plano pago ou backups (o plano grátis pausa projetos parados e não tem backup diário).
- [ ] Login com Google (opcional, decidido para depois).

## Já feito (M0–M9)

- [x] Todas as telas do v1, com estados vazios, carregamento e erros.
- [x] Funciona sem internet (registro + abas) e sincroniza depois.
- [x] RLS em todas as tabelas, testado. Nenhuma chave secreta no navegador.
- [x] Compra única com Mercado Pago (checkout de teste verificado contra a API real), webhook assinado e idempotente, `/admin`.
- [x] Exportar dados (CSV) e excluir conta.
- [x] Acessibilidade: axe sem problemas sérios em todas as telas; alvos ≥ 44 px; foco visível.
- [x] Desempenho: LCP ~2,1 s em 4G lento com CPU 4× mais lenta (primeira visita); depois, as telas abrem do aparelho.
- [x] Testes: unidade (100% em métricas, simulador e insights) e ponta a ponta (fluxo principal, offline, compra, admin).
