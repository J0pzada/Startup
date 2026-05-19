import argparse
import json
import os
import sys

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from importer import analyze_xlsx


def main():
    parser = argparse.ArgumentParser(description="Analisa estrutura de planilha XLSX para o importador do Radar")
    parser.add_argument("xlsx_path", help="Caminho do arquivo .xlsx")
    args = parser.parse_args()

    with open(args.xlsx_path, "rb") as f:
        payload = f.read()

    report = analyze_xlsx(payload)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
