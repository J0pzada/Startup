from pathlib import Path

import pandas as pd

rows = [
    {"Produto": "Pastilha de Freio Dianteira Cerâmica", "Marca": "Bosch", "SKU": "BOS-123", "EAN": "7890000000011", "Estoque": 32, "Custo": 45.5, "Preço": 89.9, "Vendidos": 64},
    {"Produto": "Filtro de Óleo Motor 1.6", "Marca": "Tecfil", "SKU": "TEC-444", "EAN": "7890000000012", "Estoque": 75, "Custo": 12.0, "Preço": 29.9, "Vendidos": 110},
    {"Produto": "Vela Ignição Iridium", "Marca": "NGK", "SKU": "NGK-908", "EAN": "7890000000013", "Estoque": 0, "Custo": 22.0, "Preço": 44.9, "Vendidos": 45},
    {"Produto": "Kit Correia Dentada", "Marca": "Gates", "SKU": "GAT-712", "EAN": "7890000000014", "Estoque": 8, "Custo": 120.0, "Preço": 239.0, "Vendidos": 9},
    {"Produto": "Lampada H7", "Marca": "Philips", "SKU": "PHI-007", "EAN": "7890000000015", "Estoque": 50, "Custo": 10.0, "Preço": 24.0, "Vendidos": 0},
]

df = pd.DataFrame(rows)
target = Path(__file__).parent / "produtos_exemplo.xlsx"
df.to_excel(target, index=False)
print(f"Arquivo gerado em: {target}")
