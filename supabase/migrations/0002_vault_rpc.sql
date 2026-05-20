-- =============================================================
-- MapaSeller — Supabase Vault + RPC para gravar tokens com segurança
-- =============================================================
-- Esta migration habilita o Supabase Vault (extensão `vault`) e cria
-- funções RPC que o backend MapaSeller chama via service role para
-- salvar/ler/atualizar/deletar secrets (ex.: tokens OAuth Mercado Livre).
--
-- O Vault armazena valores cifrados; secret_id é a chave que o backend
-- guarda em mercadolivre_accounts.token_secret_ref / refresh_token_secret_ref.
--
-- IMPORTANTE:
--   - Estas funções são `SECURITY DEFINER` e DEVEM ser chamadas SOMENTE
--     pelo backend usando a service role key.
--   - Não conceda EXECUTE em anon/authenticated. Mantenha apenas para
--     service_role / postgres.
--   - Nunca chame estas funções pelo frontend.
--
-- TODO produção:
--   - revisar IAM/grants conforme estrutura da equipe.
--   - integrar com workspace/team_id quando o multi-tenant for adicionado.
-- =============================================================

create extension if not exists supabase_vault with schema vault;

-- -------------------------------------------------------------
-- mapaseller_save_secret: cria um secret novo e retorna seu id (uuid::text)
-- -------------------------------------------------------------
create or replace function public.mapaseller_save_secret(
    p_name        text,
    p_value       text,
    p_description text default ''
) returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
    new_id uuid;
begin
    new_id := vault.create_secret(p_value, p_name, p_description);
    return new_id::text;
end;
$$;

-- -------------------------------------------------------------
-- mapaseller_read_secret: lê o valor decifrado do secret pelo id
-- -------------------------------------------------------------
create or replace function public.mapaseller_read_secret(
    p_secret_ref text
) returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
    v text;
begin
    select decrypted_secret
    into v
    from vault.decrypted_secrets
    where id::text = p_secret_ref
    limit 1;
    return v;
end;
$$;

-- -------------------------------------------------------------
-- mapaseller_update_secret: atualiza o valor de um secret existente
-- -------------------------------------------------------------
create or replace function public.mapaseller_update_secret(
    p_secret_ref text,
    p_value      text
) returns void
language plpgsql
security definer
set search_path = public, vault
as $$
begin
    perform vault.update_secret(p_secret_ref::uuid, p_value);
end;
$$;

-- -------------------------------------------------------------
-- mapaseller_delete_secret: remove um secret do Vault
-- -------------------------------------------------------------
create or replace function public.mapaseller_delete_secret(
    p_secret_ref text
) returns void
language plpgsql
security definer
set search_path = public, vault
as $$
begin
    delete from vault.secrets where id::text = p_secret_ref;
end;
$$;

-- -------------------------------------------------------------
-- Permissões: somente service_role pode executar estas funções.
-- Revoga acesso público; concede explicitamente ao backend.
-- -------------------------------------------------------------
revoke all on function public.mapaseller_save_secret(text, text, text)   from public, anon, authenticated;
revoke all on function public.mapaseller_read_secret(text)               from public, anon, authenticated;
revoke all on function public.mapaseller_update_secret(text, text)       from public, anon, authenticated;
revoke all on function public.mapaseller_delete_secret(text)             from public, anon, authenticated;

grant execute on function public.mapaseller_save_secret(text, text, text)   to service_role;
grant execute on function public.mapaseller_read_secret(text)               to service_role;
grant execute on function public.mapaseller_update_secret(text, text)       to service_role;
grant execute on function public.mapaseller_delete_secret(text)             to service_role;
