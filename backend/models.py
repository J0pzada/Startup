from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, func

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


class MarketplaceSnapshot(Base):
    __tablename__ = "marketplace_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True, index=True)
    marketplace = Column(String, nullable=False, index=True)
    mode = Column(String, nullable=True)
    query = Column(String, nullable=True)
    source_url = Column(String, nullable=True)
    total_results = Column(Integer, default=0)
    min_price = Column(Float, nullable=True)
    avg_price = Column(Float, nullable=True)
    max_price = Column(Float, nullable=True)
    median_price = Column(Float, nullable=True)
    sellers_count = Column(Integer, default=0)
    catalog_count = Column(Integer, default=0)
    free_shipping_count = Column(Integer, default=0)
    full_shipping_count = Column(Integer, default=0)
    classic_count = Column(Integer, default=0)
    premium_count = Column(Integer, default=0)
    used_count = Column(Integer, default=0)
    new_count = Column(Integer, default=0)
    estimated_monthly_sales = Column(Float, nullable=True)
    estimated_monthly_revenue = Column(Float, nullable=True)
    recommendation = Column(String, nullable=True)
    raw_summary_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class MarketplaceSnapshotItem(Base):
    __tablename__ = "marketplace_snapshot_items"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_id = Column(Integer, ForeignKey("marketplace_snapshots.id"), nullable=False, index=True)
    external_id = Column(String, nullable=True, index=True)
    title = Column(String, nullable=True)
    price = Column(Float, nullable=True)
    permalink = Column(String, nullable=True)
    seller_name = Column(String, nullable=True)
    seller_id = Column(String, nullable=True)
    seller_reputation = Column(String, nullable=True)
    condition = Column(String, nullable=True)
    listing_type = Column(String, nullable=True)
    free_shipping = Column(Integer, default=0)
    full_shipping = Column(Integer, default=0)
    thumbnail = Column(String, nullable=True)
    sold_quantity = Column(Integer, nullable=True)
    available_quantity = Column(Integer, nullable=True)
    category_id = Column(String, nullable=True)
    position = Column(Integer, nullable=True)
    raw_json = Column(Text, nullable=True)


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


MARKETPLACE_SNAPSHOT_EXTRA_COLUMNS = {
    "mode": "VARCHAR",
    "source_url": "VARCHAR",
    "median_price": "FLOAT",
    "catalog_count": "INTEGER DEFAULT 0",
    "free_shipping_count": "INTEGER DEFAULT 0",
    "full_shipping_count": "INTEGER DEFAULT 0",
    "classic_count": "INTEGER DEFAULT 0",
    "premium_count": "INTEGER DEFAULT 0",
    "used_count": "INTEGER DEFAULT 0",
    "new_count": "INTEGER DEFAULT 0",
    "estimated_monthly_sales": "FLOAT",
    "estimated_monthly_revenue": "FLOAT",
    "recommendation": "VARCHAR",
}
