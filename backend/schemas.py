from pydantic import BaseModel


class ProductOut(BaseModel):
    id: int
    name: str | None = None
    brand: str | None = None
    sku: str | None = None
    ean: str | None = None
    stock: int
    cost: float | None = None
    price: float | None = None
    sales_60d: int
    score: float
    priority: str
    status: str

    class Config:
        from_attributes = True
