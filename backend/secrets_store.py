"""Abstração de secret storage para o MapaSeller.

Tokens do Mercado Livre (access_token e refresh_token) NUNCA são salvos em
SQLite, em arquivo, nem em variáveis simples no banco. Eles são gravados
em um secret storage seguro (Supabase Vault ou equivalente). Esta camada
isola o resto do backend dessa decisão.

Regras:
- Nunca logar o valor do secret.
- Nunca retornar o secret para o frontend.
- Em produção: usar Supabase Vault via PostgREST/RPC ou serviço equivalente.
- Em dev sem Supabase: NÃO salvar token real. Levantar erro claro.
"""

from __future__ import annotations

import os
import uuid
from typing import Optional

try:
    import httpx
except ImportError:  # pragma: no cover - httpx é dependência declarada
    httpx = None


class SecretStorageNotConfigured(RuntimeError):
    """Levantado quando se tenta salvar/ler secret sem backend de secrets ativo."""


class SecretStorageError(RuntimeError):
    """Erro genérico de comunicação com o secret storage."""


def _env(name: str) -> str:
    return (os.getenv(name) or "").strip()


def is_cloud_secrets_enabled() -> bool:
    """Retorna True somente se houver Supabase configurado para guardar secrets."""
    return bool(_env("SUPABASE_URL") and _env("SUPABASE_SERVICE_ROLE_KEY"))


def get_status() -> dict:
    return {
        "configured": is_cloud_secrets_enabled(),
        "provider": "supabase_vault" if is_cloud_secrets_enabled() else None,
    }


def _supabase_headers() -> dict:
    key = _env("SUPABASE_SERVICE_ROLE_KEY")
    return {
        "apikey": key,
        "Authorization": "Bearer {0}".format(key),
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _supabase_rpc(name: str, payload: dict) -> dict:
    if httpx is None:
        raise SecretStorageError("httpx não está instalado no backend.")
    url = "{0}/rest/v1/rpc/{1}".format(_env("SUPABASE_URL").rstrip("/"), name)
    try:
        response = httpx.post(url, headers=_supabase_headers(), json=payload, timeout=10.0)
    except httpx.HTTPError as exc:
        raise SecretStorageError("Falha ao falar com Supabase: {0}".format(exc.__class__.__name__))
    if response.status_code >= 400:
        # NUNCA incluir o secret na mensagem.
        raise SecretStorageError(
            "Supabase RPC {0} retornou {1}".format(name, response.status_code)
        )
    if not response.content:
        return {}
    try:
        return response.json()
    except ValueError:
        return {}


def save_secret(name: str, value: str, description: Optional[str] = None) -> str:
    """Cria um secret no Vault e retorna a referência (uuid/string).

    Implementação atual (Vault):
        chama RPC pública `mapaseller_save_secret(p_name, p_value, p_description)`
        que deve ser criada na migration. Ela usa vault.create_secret() ou
        equivalente e retorna o id como text.

    Em ambientes sem Vault configurado, levanta SecretStorageNotConfigured —
    NUNCA persiste localmente.
    """
    if not is_cloud_secrets_enabled():
        raise SecretStorageNotConfigured(
            "Secret storage cloud não configurado. Configure Supabase Vault ou backend secrets."
        )
    # Gera um nome único por chamada para evitar conflito em ambientes compartilhados.
    secret_name = "{0}__{1}".format(name, uuid.uuid4().hex[:12])
    result = _supabase_rpc(
        "mapaseller_save_secret",
        {"p_name": secret_name, "p_value": value, "p_description": description or ""},
    )
    ref = None
    if isinstance(result, str):
        ref = result
    elif isinstance(result, dict):
        ref = result.get("secret_ref") or result.get("id") or result.get("secret_id")
    elif isinstance(result, list) and result:
        first = result[0]
        if isinstance(first, dict):
            ref = first.get("secret_ref") or first.get("id") or first.get("secret_id")
        else:
            ref = str(first)
    if not ref:
        raise SecretStorageError("RPC mapaseller_save_secret não retornou secret_ref.")
    return str(ref)


def read_secret(secret_ref: str) -> str:
    if not secret_ref:
        raise SecretStorageError("secret_ref vazio.")
    if not is_cloud_secrets_enabled():
        raise SecretStorageNotConfigured(
            "Secret storage cloud não configurado. Configure Supabase Vault ou backend secrets."
        )
    result = _supabase_rpc("mapaseller_read_secret", {"p_secret_ref": secret_ref})
    if isinstance(result, str):
        return result
    if isinstance(result, dict):
        value = result.get("secret") or result.get("decrypted_secret") or result.get("value")
        if value:
            return str(value)
    if isinstance(result, list) and result:
        first = result[0]
        if isinstance(first, dict):
            value = first.get("secret") or first.get("decrypted_secret") or first.get("value")
            if value:
                return str(value)
        else:
            return str(first)
    raise SecretStorageError("Secret não encontrado no Vault.")


def update_secret(secret_ref: str, value: str) -> str:
    if not is_cloud_secrets_enabled():
        raise SecretStorageNotConfigured(
            "Secret storage cloud não configurado. Configure Supabase Vault ou backend secrets."
        )
    _supabase_rpc("mapaseller_update_secret", {"p_secret_ref": secret_ref, "p_value": value})
    return secret_ref


def delete_secret(secret_ref: str) -> None:
    if not secret_ref:
        return
    if not is_cloud_secrets_enabled():
        # Sem cloud configurado, não há o que apagar; ignora silenciosamente.
        return
    _supabase_rpc("mapaseller_delete_secret", {"p_secret_ref": secret_ref})
