# MapaSeller — Deploy em Cloud / Uso compartilhado pela equipe

Este documento descreve como tirar o MapaSeller da máquina local e
colocar em um ambiente cloud/shared seguro, sem credenciais no Git nem
tokens em SQLite.

## 1. Arquitetura recomendada

```
┌───────────────────┐       HTTPS        ┌────────────────────────┐
│  Frontend (Vite)  │ ─────────────────▶ │  Backend FastAPI       │
│  Vercel/Netlify   │                    │  Railway/Fly/Render    │
└───────────────────┘                    │                        │
                                         │  DATABASE_URL ─────────┼──▶ Supabase Postgres
                                         │  SUPABASE_URL          │     (products, snapshots,
                                         │  SUPABASE_SERVICE_KEY ─┼──▶  mercadolivre_accounts)
                                         └─────────────┬──────────┘
                                                       │
                                                       └─▶ Supabase Vault
                                                           (tokens ML cifrados)
```

- O frontend nunca fala direto com Supabase. Sempre com o backend.
- O backend usa a service role do Supabase para gravar/ler secrets
  via funções RPC (`mapaseller_save_secret`, `mapaseller_read_secret`,
  ...). Veja `supabase/migrations/0002_vault_rpc.sql`.
- Tokens do Mercado Livre nunca tocam o SQLite. Em produção eles ficam
  no Supabase Vault. Em dev sem Vault, a aplicação bloqueia o OAuth real
  e segue só com mock.

## 2. Variáveis de ambiente do backend

Veja `.env.example`. Mínimo para produção:

```env
APP_ENV=production
PUBLIC_APP_URL=https://app.mapaseller.example
BACKEND_PUBLIC_URL=https://api.mapaseller.example
FRONTEND_ORIGIN=https://app.mapaseller.example

DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@HOST:5432/postgres
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
SUPABASE_ANON_KEY=eyJhbGciOi...

MERCADOLIVRE_ENABLED=true
MERCADOLIVRE_SITE_ID=MLB
MERCADOLIVRE_CLIENT_ID=...
MERCADOLIVRE_CLIENT_SECRET=...
MERCADOLIVRE_REDIRECT_URI=https://api.mapaseller.example/mercadolivre/auth/callback
MERCADOLIVRE_MAX_RESULTS=50
MERCADOLIVRE_TIMEOUT_SECONDS=10
MERCADOLIVRE_CACHE_TTL_HOURS=24
MERCADOLIVRE_FALLBACK_TO_MOCK=true
```

`SUPABASE_SERVICE_ROLE_KEY` e `MERCADOLIVRE_CLIENT_SECRET` jamais devem
aparecer no frontend nem em logs.

## 3. Criar o app no Mercado Livre Developers

1. Acesse <https://developers.mercadolivre.com.br> com a conta da loja.
2. Crie um aplicativo. Anote `App ID` (CLIENT_ID) e `Secret Key`
   (CLIENT_SECRET).
3. Em "Redirect URIs", adicione:
   - Local: `http://localhost:8000/mercadolivre/auth/callback`
   - Produção: `https://api.mapaseller.example/mercadolivre/auth/callback`
4. Selecione apenas os escopos que o MapaSeller precisa (`read`).

## 4. Aplicar migrations no Supabase

No SQL editor do projeto Supabase, rode em ordem:

1. `supabase/migrations/0001_init_mapaseller.sql`
2. `supabase/migrations/0002_vault_rpc.sql`

Depois confira que `vault.secrets` existe e que `mapaseller_save_secret`
está disponível em **Database → Functions**.

## 5. Conectar a conta Mercado Livre

1. Garanta que as variáveis de ambiente acima estão setadas no backend.
2. Acesse o frontend em produção.
3. Na página *Inteligência Mercado Livre*, o badge mostrará "Mercado
   Livre não conectado" e um botão **Conectar Mercado Livre**.
4. O botão abre o `authorization_url` em nova aba.
5. Após login, o Mercado Livre redireciona para
   `/mercadolivre/auth/callback`. O backend troca o code por tokens,
   grava no Vault e atualiza `mercadolivre_accounts`.
6. O badge passa a "Mercado Livre conectado" e a análise vira live.

## 6. Segurança — regras permanentes

- Tokens NUNCA no frontend.
- Tokens NUNCA no Git.
- Tokens NUNCA em SQLite/local.
- Service role do Supabase **só no backend**.
- Sem scraping HTML do Mercado Livre.
- Cache TTL respeitado (`MERCADOLIVRE_CACHE_TTL_HOURS`) para não estourar
  rate limit.
- Sem logs com `Authorization: Bearer ...`.

## 7. Fluxo de equipe

- Toda a equipe acessa o mesmo backend e o mesmo banco.
- A máquina local não é a fonte oficial — ela serve apenas para dev.
- Para experimentar localmente sem mexer no banco do time, basta deixar
  `DATABASE_URL=sqlite:///./radar_marketplace.db` (default).
- Em dev local sem Vault configurado, o OAuth real é bloqueado com
  mensagem clara; tudo segue funcionando em mock.

## 8. Limitações atuais

- Multi-tenant por workspace_id ainda não está implementado. A coluna
  existe na tabela, mas o backend trata como conta única por enquanto.
- O frontend ainda usa um único backend; quando houver SSO/login, RLS
  no Supabase precisará de políticas por workspace.
- Shopee/Amazon/Magalu seguem em mock até evoluirmos cada adapter.
