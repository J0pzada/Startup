from io import BytesIO
import re
import unicodedata
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

IGNORE_NAME_VALUES = {"", "-", "--", "nan", "none", "null", "n/a", "na", "."}
SUMMARY_MARKERS = ["total geral", "subtotal", "resumo", "soma"]

# Aliases para a planilha "Vendidos" (giro 60 dias)
FIELD_CANDIDATES = {
    "name": ["produto", "nome", "descricao", "descrição", "discriminacao", "discriminação", "description", "item"],
    "brand": ["marca", "brand", "fabricante"],
    "sku": ["codigo", "código", "sku", "cod", "referencia", "referência", "cod produto"],
    "ean": ["ean", "gtin", "codigo de barras", "código de barras", "cod barras"],
    "stock": ["estoque", "stock", "qtd estoque", "quantidade estoque", "saldo", "disponivel"],
    "cost": ["custo unitario", "custo unitário", "custo un", "vl custo", "valor custo", "custo"],
    "price": [
        "preco venda",
        "preço venda",
        "preco unitario",
        "preço unitário",
        "valor unitario",
        "valor unitário",
        "valor venda",
        "price",
        "preco",
    ],
    "sales_60d": [
        "qtde",
        "vendas_60d",
        "vendidos",
        "quantidade vendida",
        "qtd vendida",
        "venda 60",
        "ultimos 60",
        "últimos 60",
        "60 dias",
        "saida",
        "saída",
        "vendas",
    ],
}

UNIT_PRIORITY_FIELDS = {"cost", "price"}
NEGATIVE_COLUMN_MARKERS = ["total", "subtotal", "acumulado", "geral", "soma"]

# Unidades de medida típicas dos relatórios FM
ESTOQUE_UNITS = {"UN", "PC", "CX", "KG", "MT", "LT", "JG", "PR", "PT", "M", "M2", "M3"}

# Regex pivot para parsear linhas do registro de inventário
# Estrutura: <codigo> <descricao...> <NCM=8 dígitos> <UN> <qtde> <valor_unit> R$ <total>
ESTOQUE_RE = re.compile(
    r"^\s*"
    r"(?P<code>\S+)\s+"
    r"(?P<name>.+?)\s+"
    r"(?P<ncm>\d{8})\s+"
    r"(?P<unit>[A-Za-z]{1,4})\.?\s+"
    r"(?P<qtde>-?[\d.,]+)\s+"
    r"(?P<valor>-?[\d.,]+)\s+"
    r"R\$?\s*"
    r"(?P<total>-?[\d.,]+)\s*$"
)


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
        .replace("/", " ")
        .strip()
    )


def clean_text(value: Any) -> Optional[str]:
    if value is None or pd.isna(value):
        return None
    text = str(value).strip()
    return text if text else None


def clean_code_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass

    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        if value.is_integer():
            return str(int(value))
        return str(value)

    raw = str(value).strip()
    if not raw:
        return None

    lowered = raw.lower()
    if lowered in {"nan", "none", "null", "n/a", "na", "-", "--", "."}:
        return None

    normalized = raw.replace(" ", "")
    if normalized.endswith(".0"):
        head = normalized[:-2]
        if head.replace("-", "").isdigit():
            return head

    return raw


def parse_float_br(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass

    if isinstance(value, (int, float)):
        return float(value)

    text = str(value).strip()
    if not text:
        return None

    text = text.replace("R$", "").replace("r$", "").strip()
    text = text.replace(" ", "")

    comma_count = text.count(",")
    dot_count = text.count(".")

    if comma_count > 0 and dot_count > 0:
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "")
            text = text.replace(",", ".")
        else:
            text = text.replace(",", "")
    elif comma_count > 0:
        # Heurística pt-BR: vírgula é decimal; ponto poderia ser separador de milhar
        if text.count(",") == 1 and len(text.split(",")[1]) <= 3:
            text = text.replace(".", "")
            text = text.replace(",", ".")
        else:
            text = text.replace(",", "")

    try:
        return float(text)
    except Exception:
        return None


def parse_int(value: Any, default: int = 0) -> int:
    number = parse_float_br(value)
    if number is None:
        return default
    try:
        return int(round(number))
    except Exception:
        return default


# ---------------------------------------------------------------------------
# Normalizações (SKU / nome) e extração de código embutido no nome
# ---------------------------------------------------------------------------


def normalize_sku(value: Any) -> Optional[str]:
    """Limpa SKU/Código: tira .0, espaços, traços vazios, preserva zeros à esquerda."""
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass

    if isinstance(value, float):
        if value.is_integer():
            value = int(value)
        else:
            return str(value).strip() or None
    if isinstance(value, int):
        return str(value)

    raw = str(value).strip()
    if not raw:
        return None
    lowered = raw.lower()
    if lowered in {"nan", "none", "null", "n/a", "na", "-", "--", "."}:
        return None

    raw = re.sub(r"\s+", " ", raw)
    # remove .0 final típico do Excel
    if re.match(r"^-?\d+\.0$", raw):
        return raw[:-2]
    return raw


def _strip_accents(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def normalize_name(value: Any) -> Optional[str]:
    """Uppercase, sem acentos, sem pontuação irrelevante, espaços colapsados."""
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    text = _strip_accents(text)
    text = text.upper()
    text = re.sub(r"[\.,;:_]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


# Marcadores que indicam que o sufixo numérico é especificação técnica, não código
_TECH_HINT_TOKENS = (
    "ML",
    "MM",
    "CM",
    "KG",
    "G",
    "L",
    "LT",
    "A",
    "AH",
    "V",
    "W",
    "MAH",
    "RPM",
    "PSI",
    "BAR",
    "GR",
    "POL",
    "INCH",
)


def extract_code_from_name(name: str) -> Tuple[Optional[str], str]:
    """
    Tenta extrair código provável grudado no fim do nome.
    Retorna (codigo_extraido_ou_None, sku_status).
    sku_status ∈ {"codigo_extraido", "codigo_suspeito", "ausente"}.
    """
    if not name:
        return None, "ausente"

    text = name.strip()
    # Procura padrão: letras grudadas em dígitos no fim. Aceita até 6 dígitos.
    m = re.search(r"([A-Za-z])(\d{3,7})$", text)
    if not m:
        # Tenta variante com separador "/" ou "-" antes do número final
        m2 = re.search(r"[/\-]\s*(\d{3,7})$", text)
        if not m2:
            return None, "ausente"
        digits = m2.group(1)
    else:
        digits = m.group(2)

    # Verifica se o token anterior parece spec técnica (1.6, 2.0, 1.4, etc.)
    upper = text.upper()
    tail_window = upper[-30:]
    for token in _TECH_HINT_TOKENS:
        # se o número aparenta ser uma medida (ex: "350MM", "12V", "60A"), evitar
        if re.search(r"\b\d{1,4}" + token + r"\b", tail_window):
            return digits, "codigo_suspeito"

    # Se for número curto colado em padrão "1.6", "1.0", marca como suspeito
    if re.search(r"\b\d\.\d\b\s*[A-Za-z]{0,3}\d{2,4}$", text):
        return digits, "codigo_suspeito"

    if 3 <= len(digits) <= 7:
        return digits, "codigo_extraido"
    return digits, "codigo_suspeito"


# ---------------------------------------------------------------------------
# Detecção de cabeçalho e tipo da aba (formato Vendidos)
# ---------------------------------------------------------------------------


def likely_summary_row(text_values: List[str]) -> bool:
    joined = " ".join(text_values)
    return any(marker in joined for marker in SUMMARY_MARKERS)


def header_row_score(values: List[str]) -> int:
    score = 0
    if likely_summary_row(values):
        score -= 5

    for aliases in FIELD_CANDIDATES.values():
        alias_norm = [normalize_col(a) for a in aliases]
        for value in values:
            if value in alias_norm:
                score += 3
                break
            if any(alias in value for alias in alias_norm):
                score += 1
                break

    unique_non_empty = len(set([v for v in values if v]))
    if unique_non_empty >= 4:
        score += 2

    return score


def choose_header_row(df_raw: pd.DataFrame, max_scan_rows: int = 40) -> int:
    best_idx = 0
    best_score = -999
    limit = min(max_scan_rows, len(df_raw.index))

    for idx in range(limit):
        row = df_raw.iloc[idx].tolist()
        normalized = [normalize_col(str(v)) if not pd.isna(v) else "" for v in row]
        score = header_row_score(normalized)
        if score > best_score:
            best_idx = idx
            best_score = score

    return best_idx


def detect_columns(columns: List[str]) -> Dict[str, Optional[str]]:
    normalized = {col: normalize_col(col) for col in columns}
    mapping = dict((k, None) for k in FIELD_CANDIDATES.keys())  # type: Dict[str, Optional[str]]

    for field, aliases in FIELD_CANDIDATES.items():
        alias_norm = [normalize_col(a) for a in aliases]
        candidates = []  # type: List[Tuple[int, str]]
        for raw_col, norm_col in normalized.items():
            if not norm_col:
                continue

            score = 0
            if norm_col in alias_norm:
                score += 10
            if any(alias in norm_col for alias in alias_norm):
                score += 4

            if field in UNIT_PRIORITY_FIELDS and any(marker in norm_col for marker in NEGATIVE_COLUMN_MARKERS):
                score -= 6

            if "unit" in norm_col or "un" in norm_col:
                if field in UNIT_PRIORITY_FIELDS:
                    score += 3

            if score > 0:
                candidates.append((score, raw_col))

        if candidates:
            candidates.sort(key=lambda item: item[0], reverse=True)
            mapping[field] = candidates[0][1]

    return mapping


def detect_sheet_type(normalized_cols: List[str]) -> str:
    col_set = set(normalized_cols)
    has_qtde = any(c == "qtde" or c.startswith("qtde") for c in col_set)
    has_valor_custo = any("valor custo" in c for c in col_set)
    has_valor_venda = any("valor venda" in c for c in col_set)
    has_discrimina = any("discrimina" in c for c in col_set)
    has_inventario = any("inventario" in c for c in col_set) or any("registro de inventario" in c for c in col_set)

    if has_qtde and (has_valor_custo or has_valor_venda):
        return "vendidos_60d"
    if has_discrimina or has_inventario:
        return "estoque"
    return "generico"


def sanitize_name(value: Any) -> Optional[str]:
    text = clean_text(value)
    if not text:
        return None
    lowered = text.lower().strip()
    if lowered in IGNORE_NAME_VALUES:
        return None
    return text


def is_header_repeat(row_values: List[Any], expected_columns: List[str]) -> bool:
    norm_vals = set()
    for v in row_values:
        if v is None:
            continue
        try:
            if pd.isna(v):
                continue
        except Exception:
            pass
        norm_vals.add(normalize_col(str(v)))

    norm_cols = set(normalize_col(c) for c in expected_columns if c)
    if not norm_cols:
        return False
    matches = len(norm_vals & norm_cols)
    return matches >= max(3, len(norm_cols) // 2)


# ---------------------------------------------------------------------------
# Parser do formato Estoque (registro de inventário FM)
# ---------------------------------------------------------------------------


def _row_to_text(row_values: List[Any]) -> str:
    parts = []
    for v in row_values:
        text = clean_text(v)
        if text:
            parts.append(text)
    joined = " ".join(parts)
    return re.sub(r"\s+", " ", joined).strip()


def parse_estoque_row(row_values: List[Any]) -> Optional[Dict[str, Any]]:
    """Extrai (sku, nome, estoque, custo_unit, valor_total) de uma linha do registro de inventário."""
    text = _row_to_text(row_values)
    if not text:
        return None

    match = ESTOQUE_RE.match(text)
    if not match:
        return None

    unit_token = match.group("unit").upper().rstrip(".")
    if unit_token not in ESTOQUE_UNITS:
        return None

    code = match.group("code").strip()
    name_raw = match.group("name").strip()
    qtde = parse_float_br(match.group("qtde"))
    valor_unit = parse_float_br(match.group("valor"))
    total = parse_float_br(match.group("total"))

    if not code or not code.replace("-", "").replace(".", "").isdigit():
        return None

    return {
        "sku": code,
        "name": name_raw,
        "stock": int(qtde) if qtde is not None else 0,
        "cost": valor_unit,
        "valor_total_estoque": total,
    }


def _detect_estoque_sheet(df_raw: pd.DataFrame, sample_rows: int = 40) -> bool:
    """Heurística: a aba parece registro de inventário FM se >30% das primeiras N linhas casarem com o regex."""
    if df_raw.empty:
        return False
    limit = min(sample_rows, len(df_raw.index))
    hits = 0
    tried = 0
    for i in range(limit):
        row_vals = df_raw.iloc[i].tolist()
        text = _row_to_text(row_vals)
        if not text:
            continue
        tried += 1
        if ESTOQUE_RE.match(text):
            hits += 1
    if tried == 0:
        return False
    return (hits / tried) >= 0.3 and hits >= 3


def _extract_estoque_rows(sheet_name: str, df_raw: pd.DataFrame) -> Dict[str, Any]:
    rows = []
    skipped = 0
    for _, row in df_raw.iterrows():
        parsed = parse_estoque_row(row.tolist())
        if not parsed:
            skipped += 1
            continue

        sku = normalize_sku(parsed["sku"])
        name_original = parsed["name"]
        name_clean = sanitize_name(name_original) or (sku and "Produto {0}".format(sku)) or None
        if not name_clean and not sku:
            skipped += 1
            continue
        if not name_clean:
            name_clean = "Produto {0}".format(sku)

        rows.append(
            {
                "name": name_clean,
                "nome_original": name_original,
                "nome_normalizado": normalize_name(name_clean),
                "brand": None,
                "sku": sku,
                "sku_status": "presente" if sku else "ausente",
                "ean": None,
                "stock": parsed["stock"],
                "cost": parsed["cost"],
                "price": None,
                "sales_60d": 0,
                "valor_total_estoque": parsed["valor_total_estoque"],
                "origem": "estoque",
            }
        )

    return {
        "sheet": sheet_name,
        "rows_raw": int(len(df_raw.index)),
        "header_row_index": None,
        "detected_headers": [],
        "colunas_detectadas": dict((k, None) for k in FIELD_CANDIDATES.keys()),
        "tipo_detectado": "estoque",
        "linhas_validas": len(rows),
        "linhas_ignoradas": skipped,
        "rows": rows,
    }


# ---------------------------------------------------------------------------
# Extração no formato Vendidos
# ---------------------------------------------------------------------------


def is_invalid_row(record: Dict[str, Any]) -> bool:
    name = sanitize_name(record.get("name"))
    sku = clean_code_text(record.get("sku"))
    ean = clean_code_text(record.get("ean"))
    stock = parse_int(record.get("stock"), default=0)
    sales = parse_int(record.get("sales_60d"), default=0)
    cost = parse_float_br(record.get("cost"))
    price = parse_float_br(record.get("price"))

    if not name:
        return True

    text_fields = [name.lower(), clean_text(record.get("brand")) or "", sku or "", ean or ""]
    if likely_summary_row([normalize_col(t) for t in text_fields if t]):
        return True

    no_numeric_signal = stock == 0 and sales == 0 and not cost and not price
    no_valid_sku = not sku and not ean
    if no_numeric_signal and no_valid_sku:
        return True

    return False


def extract_vendidos_rows(sheet_name: str, df_raw: pd.DataFrame) -> Dict[str, Any]:
    header_idx = choose_header_row(df_raw)
    header = df_raw.iloc[header_idx].tolist()

    columns = []
    for i, value in enumerate(header):
        text = clean_text(value)
        columns.append(text if text else "col_{0}".format(i + 1))

    data = df_raw.iloc[header_idx + 1 :].copy()
    data.columns = columns

    mapping = detect_columns(columns)
    norm_cols = [normalize_col(c) for c in columns]
    sheet_type = detect_sheet_type(norm_cols)

    rows = []
    skipped = 0

    for _, row in data.iterrows():
        row_vals = row.tolist()

        if is_header_repeat(row_vals, columns):
            skipped += 1
            continue

        record = {
            "name": row.get(mapping["name"]) if mapping.get("name") else None,
            "brand": row.get(mapping["brand"]) if mapping.get("brand") else None,
            "sku": row.get(mapping["sku"]) if mapping.get("sku") else None,
            "ean": row.get(mapping["ean"]) if mapping.get("ean") else None,
            "stock": row.get(mapping["stock"]) if mapping.get("stock") else None,
            "cost": row.get(mapping["cost"]) if mapping.get("cost") else None,
            "price": row.get(mapping["price"]) if mapping.get("price") else None,
            "sales_60d": row.get(mapping["sales_60d"]) if mapping.get("sales_60d") else None,
        }

        name_clean = sanitize_name(record.get("name"))
        sku_clean = normalize_sku(record.get("sku"))
        ean_clean = clean_code_text(record.get("ean"))

        parsed = {
            "name": name_clean,
            "brand": clean_text(record.get("brand")),
            "sku": sku_clean,
            "ean": ean_clean,
            "stock": parse_int(record.get("stock"), default=0),
            "cost": parse_float_br(record.get("cost")),
            "price": parse_float_br(record.get("price")),
            "sales_60d": parse_int(record.get("sales_60d"), default=0),
        }

        # Período → unitário (Valor Custo / Qtde, Valor Venda / Qtde)
        if sheet_type == "vendidos_60d" and parsed["sales_60d"] > 0:
            qtde = parsed["sales_60d"]
            if parsed["cost"] is not None:
                parsed["cost"] = round(parsed["cost"] / qtde, 4)
            if parsed["price"] is not None:
                parsed["price"] = round(parsed["price"] / qtde, 4)

        if is_invalid_row(parsed):
            skipped += 1
            continue

        # SKU status + extração heurística quando ausente
        if parsed["sku"]:
            sku_status = "presente"
        elif parsed["ean"]:
            sku_status = "presente"
        else:
            extracted, status = extract_code_from_name(parsed["name"] or "")
            if status == "codigo_extraido" and extracted:
                parsed["sku"] = extracted
                sku_status = "codigo_extraido"
            elif status == "codigo_suspeito":
                sku_status = "codigo_suspeito"
            else:
                sku_status = "ausente"

        parsed["nome_original"] = record.get("name") if record.get("name") is not None else parsed["name"]
        parsed["nome_normalizado"] = normalize_name(parsed["name"])
        parsed["sku_status"] = sku_status
        parsed["valor_total_estoque"] = None
        parsed["origem"] = "vendidos" if sheet_type == "vendidos_60d" else "generico"

        rows.append(parsed)

    return {
        "sheet": sheet_name,
        "rows_raw": int(len(df_raw.index)),
        "header_row_index": header_idx,
        "detected_headers": columns,
        "colunas_detectadas": mapping,
        "tipo_detectado": sheet_type,
        "linhas_validas": len(rows),
        "linhas_ignoradas": skipped,
        "rows": rows,
    }


def _extract_sheet_report(sheet_name: str, df_raw: pd.DataFrame) -> Dict[str, Any]:
    if df_raw.empty:
        return {
            "sheet": sheet_name,
            "rows_raw": 0,
            "header_row_index": None,
            "detected_headers": [],
            "colunas_detectadas": dict((k, None) for k in FIELD_CANDIDATES.keys()),
            "tipo_detectado": "generico",
            "linhas_validas": 0,
            "linhas_ignoradas": 0,
            "rows": [],
        }

    if _detect_estoque_sheet(df_raw):
        return _extract_estoque_rows(sheet_name, df_raw)

    return extract_vendidos_rows(sheet_name, df_raw)


def _merge_mappings(reports: List[Dict[str, Any]]) -> Dict[str, Optional[str]]:
    merged = dict((k, None) for k in FIELD_CANDIDATES.keys())  # type: Dict[str, Optional[str]]
    best_score = dict((k, -1) for k in FIELD_CANDIDATES.keys())

    for report in reports:
        score = report["linhas_validas"]
        mapping = report["colunas_detectadas"]
        for field in FIELD_CANDIDATES.keys():
            value = mapping.get(field)
            if value and score > best_score[field]:
                merged[field] = value
                best_score[field] = score

    return merged


def _detect_global_type(reports: List[Dict[str, Any]]) -> str:
    weighted = {}  # type: Dict[str, int]
    for report in reports:
        t = report["tipo_detectado"]
        weighted[t] = weighted.get(t, 0) + int(report["linhas_validas"])
    if not weighted:
        return "generico"
    return max(weighted.items(), key=lambda item: item[1])[0]


def _collect_all_sheets(xls: pd.ExcelFile) -> List[Dict[str, Any]]:
    reports = []  # type: List[Dict[str, Any]]
    for sheet_name in xls.sheet_names:
        df_raw = xls.parse(sheet_name, header=None, dtype=object)
        reports.append(_extract_sheet_report(sheet_name, df_raw))
    return reports


def _file_origin(reports: List[Dict[str, Any]]) -> str:
    estoque = sum(int(r["linhas_validas"]) for r in reports if r["tipo_detectado"] == "estoque")
    vendidos = sum(int(r["linhas_validas"]) for r in reports if r["tipo_detectado"] == "vendidos_60d")
    if estoque > vendidos and estoque > 0:
        return "estoque"
    if vendidos > 0:
        return "vendidos"
    return "generico"


def read_xlsx(file_bytes: bytes) -> Tuple[List[Dict[str, Any]], Dict[str, Optional[str]], str]:
    xls = pd.ExcelFile(BytesIO(file_bytes), engine="openpyxl")
    reports = _collect_all_sheets(xls)
    all_rows = []  # type: List[Dict[str, Any]]
    for report in reports:
        all_rows.extend(report["rows"])
    merged_mapping = _merge_mappings(reports)
    origin = _file_origin(reports)
    return all_rows, merged_mapping, origin


def preview_xlsx(file_bytes: bytes, limit: int = 30) -> Dict[str, Any]:
    xls = pd.ExcelFile(BytesIO(file_bytes), engine="openpyxl")
    reports = _collect_all_sheets(xls)
    all_rows = []  # type: List[Dict[str, Any]]
    total_ignored = 0
    for report in reports:
        all_rows.extend(report["rows"])
        total_ignored += int(report["linhas_ignoradas"])
    mapping = _merge_mappings(reports)
    sheet_type = _detect_global_type(reports)
    origin = _file_origin(reports)
    main_sheet = max(reports, key=lambda r: r["linhas_validas"]) if reports else None
    sheet_name = main_sheet["sheet"] if main_sheet else None
    header_idx = main_sheet["header_row_index"] if main_sheet else None
    columns = main_sheet["detected_headers"] if main_sheet else []

    return {
        "tipo_detectado": sheet_type,
        "origem_arquivo": origin,
        "abas_lidas": list(xls.sheet_names),
        "sheet_used": sheet_name,
        "header_row_index": header_idx,
        "colunas_detectadas": mapping,
        "detected_headers": columns,
        "produtos_validos": len(all_rows),
        "linhas_ignoradas": total_ignored,
        "preview_rows": all_rows[:limit],
        "diagnostico_abas": [
            {
                "aba": report["sheet"],
                "tipo_detectado": report["tipo_detectado"],
                "linhas_validas": report["linhas_validas"],
                "linhas_ignoradas": report["linhas_ignoradas"],
                "header_row_index": report["header_row_index"],
            }
            for report in reports
        ],
        # legacy keys
        "total_rows_processed": len(all_rows),
        "detected_columns": mapping,
    }


def analyze_xlsx(file_bytes: bytes) -> Dict[str, Any]:
    xls = pd.ExcelFile(BytesIO(file_bytes), engine="openpyxl")
    sheets = []

    for sheet_name in xls.sheet_names:
        df_raw = xls.parse(sheet_name, header=None, dtype=object)
        report = _extract_sheet_report(sheet_name, df_raw)

        if df_raw.empty:
            sheets.append(
                {
                    "sheet": sheet_name,
                    "rows": 0,
                    "header_row_index": None,
                    "headers": [],
                    "sample_rows": [],
                    "most_filled_columns": [],
                    "detected_columns": {},
                    "sheet_type": "generico",
                    "skipped": 0,
                }
            )
            continue

        header_idx = report["header_row_index"]
        if header_idx is None:
            sheets.append(
                {
                    "sheet": sheet_name,
                    "rows": int(len(df_raw.index)),
                    "header_row_index": None,
                    "headers": [],
                    "sample_rows": report["rows"][:20],
                    "most_filled_columns": [],
                    "detected_columns": report["colunas_detectadas"],
                    "sheet_type": report["tipo_detectado"],
                    "skipped": report["linhas_ignoradas"],
                }
            )
            continue

        header = [clean_text(v) or "" for v in df_raw.iloc[header_idx].tolist()]
        data = df_raw.iloc[header_idx + 1 :].copy()
        data.columns = [h if h else "col_{0}".format(i + 1) for i, h in enumerate(header)]

        filled_counts = []
        for col in data.columns.tolist():
            count = int(data[col].notna().sum())
            if count > 0:
                filled_counts.append({"column": col, "filled": count})
        filled_counts.sort(key=lambda item: item["filled"], reverse=True)

        sheets.append(
            {
                "sheet": sheet_name,
                "rows": int(len(data.index)),
                "header_row_index": header_idx,
                "headers": data.columns.tolist(),
                "sample_rows": report["rows"][:20],
                "most_filled_columns": filled_counts[:10],
                "detected_columns": report["colunas_detectadas"],
                "sheet_type": report["tipo_detectado"],
                "skipped": report["linhas_ignoradas"],
            }
        )

    return {"sheet_names": list(xls.sheet_names), "sheets": sheets}
