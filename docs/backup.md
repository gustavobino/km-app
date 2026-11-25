# Backup do banco (grátis)

Toda **segunda-feira às 03:17** (horário de Brasília) o GitHub Actions copia o banco do Supabase, **criptografa com uma senha** e guarda o arquivo por **90 dias** (cerca de 13 cópias). Arquivo: `.github/workflows/backup.yml`.

O que entra: todas as tabelas do app (`public`: perfis, dias, ganhos, gastos, pagamentos, acessos…) e as contas de login (`auth.users`, `auth.identities`).

## Configuração (uma vez)

No GitHub: repositório **km-app** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Nome | Valor |
|---|---|
| `SUPABASE_DB_URL` | Supabase → **Connect** → **Session pooler** (porta **5432**), com a senha do banco no lugar de `[YOUR-PASSWORD]` |
| `BACKUP_PASSPHRASE` | uma senha longa (16+ caracteres) que **você guarda fora do GitHub** (ex.: gerenciador de senhas). Sem ela, o backup não abre. |

Para testar na hora: **Actions** → **Database backup** → **Run workflow**.

## Baixar e abrir uma cópia

1. GitHub → **Actions** → **Database backup** → escolha uma execução → em **Artifacts**, baixe `kmplus-backup-AAAA-MM-DD` (vem um .zip).
2. Descompacte o .zip e abra o arquivo com a senha:

```bash
gpg --decrypt kmplus-backup-AAAA-MM-DD.tar.gz.gpg > backup.tar.gz && tar -xzf backup.tar.gz
```

Saem `public.sql` (tabelas do app) e `auth-users.sql` (contas).

## Restaurar (só em emergência)

Num projeto Supabase **novo** (ou depois de apagar as tabelas do app), com a URL de conexão dele:

```bash
psql "$NOVA_DB_URL" -f auth-users.sql
```

```bash
psql "$NOVA_DB_URL" -f public.sql
```

Depois rode de novo `db/migrations/*` só se faltar algo (o `public.sql` já traz tabelas, RLS e funções) e confira o app. Na dúvida, peça ajuda antes de restaurar: restaurar por cima de dados atuais pode duplicar ou apagar registros.
