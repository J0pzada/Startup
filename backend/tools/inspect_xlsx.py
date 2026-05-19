#!/usr/bin/env python3
"""
Ferramenta de diagnóstico para planilhas XLSX do MapaSeller.

Uso:
  python backend/tools/inspect_xlsx.py arquivo.xlsx
  python backend/tools/inspect_xlsx.py arquivo.xlsx --raw       # mostra linhas brutas
  python backend/tools/inspect_xlsx.py arquivo.xlsx --preview   # mostra preview processado
"""
import argparse
import json
import os
import sys

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import pandas as pd
from importer import analyze_xlsx, preview_xlsx


def _safe_isna(v):
    try:
        return pd.isna(v)
    except Exception:
        return False


def show_raw_sheet(xls_path, sheet_name, n_rows=25):
    df = pd.read_excel(xls_path, sheet_name=sheet_name, header=None, dtype=object, nrows=n_rows)
    print("\n=== Aba: {!r} — primeiras {} linhas brutas ===".format(sheet_name, n_rows))
    for i, row in df.iterrows():
        cells = [(j, str(v)) for j, v in enumerate(row.tolist()) if v is not None and not _safe_isna(v)]
        if cells:
            print("  linha {:3d}: {}".format(i, cells))


def main():
    parser = argparse.ArgumentParser(description="Diagnostica planilha XLSX para o MapaSeller")
    parser.add_argument("xlsx_path", help="Caminho do arquivo .xlsx")
    parser.add_argument("--raw", action="store_true", help="Mostra linhas brutas de cada aba (primeiras 25)")
    parser.add_argument("--preview", action="store_true", help="Mostra preview processado (30 linhas)")
    args = parser.parse_args()

    path = args.xlsx_path
    if not os.path.exists(path):
        print("ERRO: arquivo não encontrado: {}".format(path))
        sys.exit(1)

    print("\n" + "=" * 60)
    print("DIAGNÓSTICO: {}".format(os.path.basename(path)))
    print("=" * 60)

    xls = pd.ExcelFile(path, engine="openpyxl")
    print("\nAbas encontradas: {}".format(xls.sheet_names))

    if args.raw:
        for sheet in xls.sheet_names:
            show_raw_sheet(path, sheet)

    with open(path, "rb") as f:
        raw_bytes = f.read()

    report = analyze_xlsx(raw_bytes)

    print("\n--- Análise estrutural ---")
    for sh in report["sheets"]:
        print("\nAba: {!r}".format(sh["sheet"]))
        print("  Tipo detectado  : {}".format(sh["sheet_type"]))
        print("  Linhas de dados : {}".format(sh["rows"]))
        print("  Linhas ignoradas: {}".format(sh["skipped"]))
        print("  Linha do header : {}".format(sh["header_row_index"]))
        print("  Colunas         : {}".format(sh["headers"]))
        print("  Mapeamento      : {}".format(json.dumps(sh["detected_columns"], ensure_ascii=False)))
        if sh["sample_rows"]:
            n = min(5, len(sh["sample_rows"]))
            print("  Primeiros {} produtos válidos:".format(n))
            for row in sh["sample_rows"][:n]:
                print("    {}".format(row))

    if args.preview:
        print("\n--- Preview processado (30 linhas) ---")
        prev = preview_xlsx(raw_bytes, limit=30)
        print("Tipo detectado  : {}".format(prev["tipo_detectado"]))
        print("Abas lidas      : {}".format(prev["abas_lidas"]))
        print("Aba usada       : {}".format(prev["sheet_used"]))
        print("Produtos válidos: {}".format(prev["produtos_validos"]))
        print("Linhas ignoradas: {}".format(prev["linhas_ignoradas"]))
        print("Diagnóstico por aba:")
        for d in prev.get("diagnostico_abas", []):
            print(
                "  - {} | tipo={} | validas={} | ignoradas={} | header={}".format(
                    d.get("aba"), d.get("tipo_detectado"), d.get("linhas_validas"), d.get("linhas_ignoradas"), d.get("header_row_index")
                )
            )
        print("Colunas         :\n{}".format(json.dumps(prev["colunas_detectadas"], ensure_ascii=False, indent=2)))
        print("\nPrimeiras linhas:")
        for r in prev["preview_rows"][:10]:
            print("  {}".format(r))


if __name__ == "__main__":
    main()
