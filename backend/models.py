from sqlalchemy import Column, DateTime, Float, Integer, String, func

from database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=True, index=True)
    brand = Column(String, nullable=True, index=True)
    sku = Column(String, nullable=True, index=True)
    ean = Column(String, nullable=True, index=True)
    stock = Column(Integer, default=0)
    cost = Column(Float, nullable=True)
    price = Column(Float, nullable=True)
    sales_60d = Column(Integer, default=0)
    score = Column(Float, default=0.0)
    priority = Column(String, default="Revisar")
    status = Column(String, default="revisar")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # merge / qualidade
    origem_importacao = Column(String, nullable=True, default="vendidos")
    match_status = Column(String, nullable=True)
    estoque_status = Column(String, nullable=True)
    alerta = Column(String, nullable=True)
    nome_original = Column(String, nullable=True)
    nome_normalizado = Column(String, nullable=True, index=True)
    sku_status = Column(String, nullable=True)
    valor_total_estoque = Column(Float, nullable=True)
    margem_pct = Column(Float, nullable=True)


PRODUCT_EXTRA_COLUMNS = {
    "origem_importacao": "VARCHAR",
    "match_status": "VARCHAR",
    "estoque_status": "VARCHAR",
    "alerta": "VARCHAR",
    "nome_original": "VARCHAR",
    "nome_normalizado": "VARCHAR",
    "sku_status": "VARCHAR",
    "valor_total_estoque": "FLOAT",
    "margem_pct": "FLOAT",
}
