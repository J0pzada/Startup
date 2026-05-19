from typing import Optional

from pydantic import BaseModel


class ProductOut(BaseModel):
    id: int
    name: Optional[str] = None
    brand: Optional[str] = None
    sku: Optional[str] = None
    ean: Optional[str] = None
    stock: int
    cost: Optional[float] = None
    price: Optional[float] = None
    sales_60d: int
    score: float
    priority: str
    status: str
    origem_importacao: Optional[str] = None
    match_status: Optional[str] = None
    estoque_status: Optional[str] = None
    alerta: Optional[str] = None
    nome_original: Optional[str] = None
    nome_normalizado: Optional[str] = None
    sku_status: Optional[str] = None
    valor_total_estoque: Optional[float] = None
    margem_pct: Optional[float] = None

    class Config:
        from_attributes = True
