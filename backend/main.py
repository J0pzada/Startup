from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from importer import read_xlsx
from marketplace.amazon import AmazonAdapter
from marketplace.magalu import MagaluAdapter
from marketplace.mercadolivre import MercadoLivreAdapter
from marketplace.shopee import ShopeeAdapter
from models import Product
from scoring import calculate_score, margin_pct, priority_from_score

app = FastAPI(title="Radar Marketplace FM API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

adapters = [MercadoLivreAdapter(), ShopeeAdapter(), AmazonAdapter(), MagaluAdapter()]


def serialize_product(product: Product):
    return {
        "id": product.id,
        "name": product.name,
        "brand": product.brand,
        "sku": product.sku,
        "ean": product.ean,
        "stock": product.stock,
        "cost": product.cost,
        "price": product.price,
        "sales_60d": product.sales_60d,
        "score": product.score,
        "priority": product.priority,
        "status": product.status,
    }


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    products = db.query(Product).all()
    total = len(products)
    with_stock = len([p for p in products if (p.stock or 0) > 0])
    sold_60d = len([p for p in products if (p.sales_60d or 0) > 0])
    high_score = len([p for p in products if (p.score or 0) >= 70])
    stalled_stock = len([p for p in products if (p.stock or 0) > 0 and (p.sales_60d or 0) == 0])
    return {
        "total_products": total,
        "products_with_stock": with_stock,
        "products_sold_60d": sold_60d,
        "products_high_score": high_score,
        "stalled_stock_alert": stalled_stock,
    }


@app.post("/upload-xlsx")
async def upload_xlsx(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Arquivo deve ser .xlsx")

    content = await file.read()
    rows, mapping = read_xlsx(content)
    imported = 0

    for row in rows:
        score = calculate_score(row["name"], row["stock"], row["sales_60d"], row["cost"], row["price"])
        priority, status = priority_from_score(score)
        product = Product(
            name=row["name"],
            brand=row["brand"],
            sku=row["sku"],
            ean=row["ean"],
            stock=row["stock"],
            cost=row["cost"],
            price=row["price"],
            sales_60d=row["sales_60d"],
            score=score,
            priority=priority,
            status=status,
        )
        db.add(product)
        imported += 1

    db.commit()
    return {"imported": imported, "column_mapping": mapping}


@app.get("/products")
def list_products(
    search: str | None = None,
    in_stock: bool | None = None,
    sold: bool | None = None,
    min_score: float | None = Query(default=None, ge=0, le=100),
    max_score: float | None = Query(default=None, ge=0, le=100),
    status: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Product)

    if search:
        q = f"%{search}%"
        query = query.filter(or_(Product.name.ilike(q), Product.brand.ilike(q), Product.sku.ilike(q), Product.ean.ilike(q)))
    if in_stock is True:
        query = query.filter(Product.stock > 0)
    if sold is True:
        query = query.filter(Product.sales_60d > 0)
    if min_score is not None:
        query = query.filter(Product.score >= min_score)
    if max_score is not None:
        query = query.filter(Product.score <= max_score)
    if status:
        query = query.filter(Product.status == status)

    total = query.count()
    items = query.order_by(Product.score.desc()).offset(offset).limit(limit).all()
    return {"total": total, "items": [serialize_product(p) for p in items]}


def ad_keywords(product: Product):
    parts = [product.name or "", product.brand or "", product.sku or ""]
    seed = " ".join(parts).lower().replace("-", " ")
    tokens = [t for t in seed.split() if len(t) > 2]
    dedup = []
    for token in tokens:
        if token not in dedup:
            dedup.append(token)
    return dedup[:10]


@app.get("/products/{product_id}")
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    margin = margin_pct(product.cost, product.price)
    recommendation = product.priority
    keywords = ad_keywords(product)

    return {
        **serialize_product(product),
        "recommendation": recommendation,
        "margin_pct": round(margin, 2) if margin is not None else None,
        "ad_creator": {
            "suggested_title": f"{product.name or 'Produto'} {product.brand or ''}".strip(),
            "base_description": (
                f"{product.name or 'Produto'} da marca {product.brand or 'não informada'}. "
                "Item com foco em giro e competitividade para marketplace."
            ),
            "keywords": keywords,
        },
    }


@app.get("/products/{product_id}/marketplaces")
def product_marketplaces(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    return {"items": [adapter.get_product_snapshot(product) for adapter in adapters]}
