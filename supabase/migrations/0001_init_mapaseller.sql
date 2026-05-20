-- =============================================================
-- MapaSeller — schema inicial para Supabase / Postgres compartilhado
-- =============================================================
-- Esta migration cria as tabelas principais do MapaSeller em Postgres,
-- pensadas para uso em equipe. Tokens do Mercado Livre NUNCA ficam aqui.
-- Eles vão para o Supabase Vault, e somente referências (secret_ref) são
-- guardadas em mercadolivre_accounts.
--
-- Como aplicar:
--   1) abra o SQL editor do projeto Supabase
--   2) cole este arquivo e execute
--   3) opcionalmente rode 0002_vault_rpc.sql para habilitar o Vault
--
-- Toda escrita feita pelo backend usa a service role key (server-side).
-- O frontend NUNCA recebe tokens — só metadados (nickname, expira em, etc).

-- -------------------------------------------------------------
-- Extensões úteis
-- -------------------------------------------------------------
create extension if not exists "uuid-ossp";

-- -------------------------------------------------------------
-- products: catálogo importado pelas planilhas (Vendidos + Estoque)
-- -------------------------------------------------------------
create table if not exists public.products (
    id              bigserial primary key,
    name            text,
    brand           text,
    sku             text,
    ean             text,
    stock           integer default 0,
    cost            double precision,
    price           double precision,
    sales_60d       integer default 0,
    score           double precision default 0,
    priority        text default 'Revisar',
    status          text default 'revisar',
    created_at      timestamptz default now(),
    updated_at      timestamptz default now(),
    origem_importacao   text default 'vendidos',
    match_status        text,
    estoque_status      text,
    alerta              text,
    nome_original       text,
    nome_normalizado    text,
    sku_status          text,
    valor_total_estoque double precision,
    margem_pct          double precision
);

create index if not exists products_sku_idx on public.products (sku);
create index if not exists products_brand_idx on public.products (brand);
create index if not exists products_nome_norm_idx on public.products (nome_normalizado);

-- -------------------------------------------------------------
-- marketplace_snapshots: cache de análise de marketplace por produto/URL.
-- É compartilhado por toda a equipe quando o backend aponta para este DB.
-- -------------------------------------------------------------
create table if not exists public.marketplace_snapshots (
    id              bigserial primary key,
    product_id      bigint references public.products(id) on delete set null,
    marketplace     text not null,
    mode            text,
    query           text,
    source_url      text,
    total_results   integer default 0,
    min_price       double precision,
    avg_price       double precision,
    max_price       double precision,
    median_price    double precision,
    sellers_count   integer default 0,
    catalog_count   integer default 0,
    free_shipping_count integer default 0,
    full_shipping_count integer default 0,
    classic_count   integer default 0,
    premium_count   integer default 0,
    used_count      integer default 0,
    new_count       integer default 0,
    estimated_monthly_sales   double precision,
    estimated_monthly_revenue double precision,
    recommendation  text,
    raw_summary_json text,
    created_at      timestamptz default now()
);

create index if not exists ml_snap_product_idx on public.marketplace_snapshots (product_id);
create index if not exists ml_snap_market_idx  on public.marketplace_snapshots (marketplace);
create index if not exists ml_snap_url_idx     on public.marketplace_snapshots (source_url);
create index if not exists ml_snap_created_idx on public.marketplace_snapshots (created_at desc);

create table if not exists public.marketplace_snapshot_items (
    id              bigserial primary key,
    snapshot_id     bigint not null references public.marketplace_snapshots(id) on delete cascade,
    external_id     text,
    title           text,
    price           double precision,
    permalink       text,
    seller_name     text,
    seller_id       text,
    seller_reputation text,
    condition       text,
    listing_type    text,
    free_shipping   integer default 0,
    full_shipping   integer default 0,
    thumbnail       text,
    sold_quantity   integer,
    available_quantity integer,
    category_id     text,
    position        integer,
    raw_json        text
);

create index if not exists ml_snap_items_snap_idx on public.marketplace_snapshot_items (snapshot_id);

-- -------------------------------------------------------------
-- mercadolivre_accounts: somente METADADOS da conta conectada.
-- Tokens (access_token, refresh_token) ficam no Supabase Vault.
-- token_secret_ref e refresh_token_secret_ref guardam apenas a referência.
-- -------------------------------------------------------------
create table if not exists public.mercadolivre_accounts (
    id              bigserial primary key,
    workspace_id    text,
    user_label      text,
    site_id         text not null default 'MLB',
    seller_user_id  text,
    nickname        text,
    token_secret_ref         text,
    refresh_token_secret_ref text,
    token_expires_at timestamptz,
    scope           text,
    is_active       boolean default true,
    created_at      timestamptz default now(),
    updated_at      timestamptz default now()
);

create index if not exists ml_accounts_seller_idx on public.mercadolivre_accounts (seller_user_id);
create index if not exists ml_accounts_active_idx on public.mercadolivre_accounts (is_active);

comment on column public.mercadolivre_accounts.token_secret_ref is
    'Referência para o secret armazenado no Supabase Vault (NÃO contém o token em si). Backend lê o token via secrets_store.read_secret().';
comment on column public.mercadolivre_accounts.refresh_token_secret_ref is
    'Referência para o refresh_token no Supabase Vault. Nunca exponha esta referência ao frontend; ela só faz sentido para o backend service role.';

-- -------------------------------------------------------------
-- RLS — Row Level Security
-- -------------------------------------------------------------
-- O MapaSeller (MVP) é backend-only: somente o backend com service role acessa.
-- O frontend fala APENAS com o backend, nunca direto com Postgres / Supabase.
-- Ainda assim, habilitamos RLS por segurança: por padrão, ninguém autenticado
-- pelo anon/anonymous key consegue ler/escrever nada. Sem políticas públicas.
alter table public.products                    enable row level security;
alter table public.marketplace_snapshots       enable row level security;
alter table public.marketplace_snapshot_items  enable row level security;
alter table public.mercadolivre_accounts       enable row level security;

-- Em produção, criar políticas baseadas em workspace/team_id após auth.
-- Não criar nenhuma política `using (true)` — isso abriria a base para o público.
