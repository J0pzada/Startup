from io import BytesIO
from typing import Any

import pandas as pd

FIELD_CANDIDATES = {
    "name": ["produto", "nome", "descricao", "descrição", "description"],
    "brand": ["marca", "brand"],
    "sku": ["codigo", "código", "sku", "cod", "referencia"],
    "ean": ["ean", "gtin", "codigo de barras", "código de barras"],
    "stock": ["estoque", "stock", "qtd estoque", "quantidade estoque"],
    "cost": ["custo", "cost", "valor custo"],
    "price": ["preco", "preço", "price", "valor venda"],
    "sales_60d": ["vendas_60d", "vendidos", "quantidade vendida", "vendas 60d", "vendas"],
}


def normalize_col(value: str) -> str:
    return (
        value.lower()
        .replace("ç", "c")
        .replace("ã", "a")
        .replace("á", "a")
        .replace("é", "e")
        .replace("ê", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ô", "o")
        .replace("ú", "u")
        .replace("_", " ")
        .strip()
    )


def detect_columns(columns: list[str]) -> dict[str, str | None]:
    normalized = {col: normalize_col(col) for col in columns}
    mapping: dict[str, str | None] = {k: None for k in FIELD_CANDIDATES}

    for field, aliases in FIELD_CANDIDATES.items():
        alias_norm = [normalize_col(a) for a in aliases]
        for raw_col, norm_col in normalized.items():
            if norm_col in alias_norm:
                mapping[field] = raw_col
                break
        if mapping[field]:
            continue
        for raw_col, norm_col in normalized.items():
            if any(alias in norm_col for alias in alias_norm):
                mapping[field] = raw_col
                break

    return mapping


def to_int(value: Any, default: int = 0) -> int:
    if pd.isna(value):
        return default
    try:
        return int(float(value))
    except Exception:
        return default


def to_float(value: Any):
    if pd.isna(value):
        return None
    try:
        return float(value)
    except Exception:
        return None


def to_text(value: Any):
    if pd.isna(value):
        return None
    text = str(value).strip()
    return text if text else None


def read_xlsx(file_bytes: bytes):
    df = pd.read_excel(BytesIO(file_bytes), engine="openpyxl")
    df.columns = [str(c).strip() for c in df.columns]
    mapping = detect_columns(list(df.columns))

    rows = []
    for _, row in df.iterrows():
        rows.append(
            {
                "name": to_text(row.get(mapping["name"])) if mapping["name"] else None,
                "brand": to_text(row.get(mapping["brand"])) if mapping["brand"] else None,
                "sku": to_text(row.get(mapping["sku"])) if mapping["sku"] else None,
                "ean": to_text(row.get(mapping["ean"])) if mapping["ean"] else None,
                "stock": to_int(row.get(mapping["stock"])) if mapping["stock"] else 0,
                "cost": to_float(row.get(mapping["cost"])) if mapping["cost"] else None,
                "price": to_float(row.get(mapping["price"])) if mapping["price"] else None,
                "sales_60d": to_int(row.get(mapping["sales_60d"])) if mapping["sales_60d"] else 0,
            }
        )

    return rows, mapping
