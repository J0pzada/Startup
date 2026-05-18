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
