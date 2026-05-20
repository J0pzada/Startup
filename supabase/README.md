# Supabase / Postgres para o MapaSeller

Esta pasta concentra a parte cloud do MapaSeller. O objetivo é que o time
inteiro use um banco compartilhado e tokens seguros, sem depender de
SQLite local nem de credenciais em arquivo.

## Migrations

Aplique nesta ordem no SQL editor do projeto Supabase:

1. `migrations/0001_init_mapaseller.sql` — cria as tabelas principais
   (`products`, `marketplace_snapshots`, `marketplace_snapshot_items`,
   `mercadolivre_accounts`) e habilita RLS sem políticas públicas.
2. `migrations/0002_vault_rpc.sql` — habilita o Supabase Vault e cria as
   funções RPC (`mapaseller_save_secret`, `mapaseller_read_secret`,
   `mapaseller_update_secret`, `mapaseller_delete_secret`) que o backend
   usa para guardar os tokens do Mercado Livre.

Após aplicar:

- Pegue `Project URL` e `service_role key` em Project Settings → API.
- Configure no backend:
  - `SUPABASE_URL=https://xxxx.supabase.co`
  - `SUPABASE_SERVICE_ROLE_KEY=...` (NUNCA no frontend)
  - `DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@HOST:5432/postgres`

## Por que os tokens não ficam em `mercadolivre_accounts`

A tabela guarda só metadados (nickname, seller_user_id, expira em, escopo,
referência do secret). Os tokens reais ficam cifrados no Vault. O backend
lê com a service role usando `secrets_store.read_secret(secret_ref)`. O
frontend nunca recebe nem a referência, nem o token.

## RLS

As tabelas têm RLS ligado e nenhuma política pública. O acesso é exclusivo
via service role no backend FastAPI. Quando houver login multi-tenant,
adicione políticas por `workspace_id` em vez de abrir tudo.
