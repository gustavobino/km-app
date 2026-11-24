# Pagamentos — como configurar o Mercado Pago

O Km+ vende acesso por **compra única** (R$ 17,90, em `PRICE_BRL_CENTS`) pelo **Mercado Pago Checkout Pro** (Pix e cartão). Conta de **pessoa física**.

## Como funciona

1. O usuário toca em **Comprar** → o servidor cria uma "preferência" no Mercado Pago com `external_reference` = id do usuário → o usuário paga na página do Mercado Pago.
2. O Mercado Pago chama o **webhook** `POST /api/webhooks/mercadopago`.
3. O servidor **valida a assinatura** (`x-signature`, HMAC-SHA256 com o segredo do webhook), **consulta o pagamento na API do Mercado Pago** (nunca confia no retorno do navegador) e grava em `payments`. Se aprovado, com valor e moeda corretos, cria `entitlements(plan='premium')`.
4. Tudo é **idempotente**: o mesmo aviso pode chegar várias vezes sem duplicar nada.
5. Enquanto isso, a tela "Confirmando seu pagamento…" consulta `/api/entitlement` a cada 4 s e abre o app quando o acesso é liberado.

Todas as checagens de acesso passam por `lib/entitlements.ts` (`can(user, feature)`).

## Reembolso (7 dias, direito de arrependimento)

- Faça o estorno no painel do Mercado Pago (Atividade → o pagamento → Devolver).
- O Mercado Pago avisa o webhook com status `refunded` e o acesso é **revogado sozinho**.
- Se precisar, revogue na mão em **`/admin`** (botão "Revogar acesso", informando o motivo).

## Passo a passo (dono do app)

### 1. Credenciais de teste (agora)
1. Entre em https://www.mercadopago.com.br/developers/panel/app e clique em **Criar aplicação**.
2. Nome: `Km+`. Solução: **Pagamentos online** → **Checkout Pro**. Não usa plataforma de e-commerce.
3. Na aplicação criada, abra **Credenciais de teste**. Você verá a **Public Key** e o **Access Token** (começa com `TEST-` ou `APP_USR-`, dependendo da conta).
4. O Access Token é **secreto**: ele vai só para variáveis de ambiente (Vercel) ou para o formulário seguro do ambiente do Claude. Nunca no chat, nunca no GitHub.

### 2. Webhook (depois do deploy, no M9)
1. Na aplicação, menu **Webhooks** → **Configurar notificações** → modo de teste.
2. URL: `https://SEU-DOMINIO/api/webhooks/mercadopago`. Evento: **Pagamentos**.
3. Salve e copie a **assinatura secreta** → variável `MERCADOPAGO_WEBHOOK_SECRET` na Vercel.

### 3. Produção (antes de lançar)
1. Ative as **credenciais de produção** (o Mercado Pago pede dados da conta e aceite dos termos).
2. Troque `MERCADOPAGO_ACCESS_TOKEN` e `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` na Vercel pelas de produção e configure o webhook em modo produção (novo segredo).
3. Faça uma compra real de R$ 17,90 e o estorno, para conferir o fluxo inteiro.

## Variáveis

| Variável | Onde | O que é |
|---|---|---|
| `PRICE_BRL_CENTS` | Vercel | preço em centavos (`1790`) |
| `MERCADOPAGO_ACCESS_TOKEN` | Vercel (secreta) | token da aplicação |
| `MERCADOPAGO_WEBHOOK_SECRET` | Vercel (secreta) | assinatura secreta do webhook |
| `NEXT_PUBLIC_SITE_URL` | Vercel | endereço público do app (URLs de retorno e do webhook) |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (secreta) | grava pagamentos e acessos |
| `ADMIN_EMAILS` | Vercel | e-mails com acesso ao `/admin`, separados por vírgula |

## Status

- 24/11/2026: credencial de **teste** configurada (aplicação "kmmais", Checkout Pro). A criação do checkout foi verificada contra a API real do Mercado Pago (teste de ponta a ponta `real checkout`, rodar com `E2E_MERCADOPAGO=1 scripts/e2e-cloud.sh`).
- O retorno automático (`auto_return`) só é enviado com endereço HTTPS: o Mercado Pago recusa `http://localhost`. Em desenvolvimento, depois de pagar, volte ao app manualmente.
- Falta (M9): webhook com o endereço público e um pagamento de teste completo (cartão de teste "APRO") até a liberação do acesso.
- **Segurança:** o token de teste chegou a ser colado no chat. Por ser de teste o risco é baixo, mas renove-o (Credenciais de teste → Renovar) antes do lançamento e use o novo só pelo formulário seguro / variáveis da Vercel.

## Testes

- Unidade: assinatura, cliente da API (respostas simuladas), processamento idempotente, webhook (`lib/payments/*.test.ts`), regras de acesso (`lib/entitlements.test.ts`).
- Ponta a ponta: tela de compra, bloqueio das telas, espera da confirmação, webhook com assinatura válida/inválida, admin (`e2e/compra.spec.ts`).
