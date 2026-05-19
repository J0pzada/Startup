from typing import Optional

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import Base, engine, ensure_columns, get_db
from importer import preview_xlsx, read_xlsx
from marketplace.amazon import AmazonAdapter
from marketplace.magalu import MagaluAdapter
from marketplace.mercadolivre import MercadoLivreAdapter
from marketplace.shopee import ShopeeAdapter
from models import PRODUCT_EXTRA_COLUMNS, Product
from scoring import (
    calculate_score,
    classify_alerta,
    classify_estoque_status,
    margin_pct,
    priority_from_score,
)

app = FastAPI(title="MapaSeller API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)
ensure_columns("products", PRODUCT_EXTRA_COLUMNS)

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
        "origem_importacao": product.origem_importacao,
        "match_status": product.match_status,
        "estoque_status": product.estoque_status,
        "alerta": product.alerta,
        "nome_original": product.nome_original,
        "nome_normalizado": product.nome_normalizado,
        "sku_status": product.sku_status,
        "valor_total_estoque": product.valor_total_estoque,
        "margem_pct": product.margem_pct,
    }


@app.get("/health")
def health():
    return {"ok": True}


def _alertas_counter(products):
    counter = {}
    for p in products:
        key = p.alerta or "Ok"
        counter[key] = counter.get(key, 0) + 1
    return counter


def _top_n(items, n=10):
    return [serialize_product(p) for p in items[:n]]


@app.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    products = db.query(Product).all()
    total = len(products)
    with_stock = len([p for p in products if (p.stock or 0) > 0])
    sold_60d = len([p for p in products if (p.sales_60d or 0) > 0])
    high_score = len([p for p in products if (p.score or 0) >= 70])
    stalled_stock = len([p for p in products if p.alerta == "Estoque parado"])
    negative_stock = len([p for p in products if (p.stock or 0) < 0])
    sem_sku = len([p for p in products if not p.sku or p.sku_status in ("ausente", "codigo_suspeito")])
    sem_estoque_geral = len([p for p in products if p.match_status == "sem_estoque_geral"])
    somente_estoque = len([p for p in products if (p.origem_importacao or "") == "estoque"])
    reposicao_urgente = len([p for p in products if p.alerta == "Reposição urgente"])
    match_sku = len([p for p in products if p.match_status == "sku_match"])
    match_nome = len([p for p in products if p.match_status == "nome_match_fraco"])
    so_vendidos = len([p for p in products if (p.origem_importacao or "") == "vendidos"])
    so_estoque = somente_estoque
    vendidos_estoque = len([p for p in products if (p.origem_importacao or "") == "vendidos+estoque"])

    sorted_by_score = sorted(products, key=lambda p: (p.score or 0), reverse=True)
    top_oportunidades = [p for p in sorted_by_score if p.status in ("announce_first", "good_opportunity")]
    top_reposicao = [p for p in sorted_by_score if p.alerta == "Reposição urgente"]
    top_estoque_parado = sorted(
        [p for p in products if p.alerta == "Estoque parado"],
        key=lambda p: (p.stock or 0),
        reverse=True,
    )
    top_revisar_sku = [p for p in products if p.sku_status in ("ausente", "codigo_suspeito")]

    return {
        "total_products": total,
        "products_with_stock": with_stock,
        "products_sold_60d": sold_60d,
        "products_high_score": high_score,
        "stalled_stock_alert": stalled_stock,
        "negative_stock_alert": negative_stock,
        "products_without_sku": sem_sku,
        "products_without_stock_general": sem_estoque_geral,
        "products_only_stock": somente_estoque,
        "products_replenishment_urgent": reposicao_urgente,
        "match_sku": match_sku,
        "match_nome": match_nome,
        "only_vendidos": so_vendidos,
        "only_estoque": so_estoque,
        "vendidos_plus_estoque": vendidos_estoque,
        "alert_counter": _alertas_counter(products),
        "top_oportunidades": _top_n(top_oportunidades, 10),
        "top_reposicao_urgente": _top_n(top_reposicao, 10),
        "top_estoque_parado": _top_n(top_estoque_parado, 10),
        "top_revisar_sku": _top_n(top_revisar_sku, 10),
    }


@app.post("/upload-xlsx/preview")
async def upload_xlsx_preview(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Arquivo deve ser .xlsx")

    content = await file.read()
    return preview_xlsx(content)


@app.post("/preview-xlsx")
async def preview_xlsx_alias(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Arquivo deve ser .xlsx")

    content = await file.read()
    return preview_xlsx(content)


def _find_existing(db: Session, sku: Optional[str], nome_normalizado: Optional[str]):
    """Match por SKU se houver; fallback por nome_normalizado SÓ se SKU ausente."""
    if sku:
        existing = db.query(Product).filter(Product.sku == sku).first()
        if existing:
            return existing, "sku_match"
        return None, None
    if nome_normalizado:
        existing = (
            db.query(Product).filter(Product.nome_normalizado == nome_normalizado).first()
        )
        if existing:
            return existing, "nome_match_fraco"
    return None, None


def _refresh_metrics(product: Product):
    margem = margin_pct(product.cost, product.price)
    product.margem_pct = round(margem, 2) if margem is not None else None
    product.estoque_status = classify_estoque_status(product.stock)
    product.alerta = classify_alerta(product.stock, product.sales_60d, product.sku_status, product.match_status)
    product.score = calculate_score(
        product.name,
        product.stock,
        product.sales_60d,
        product.cost,
        product.price,
        product.sku_status,
        product.match_status,
        product.match_status,
    )
    priority, status = priority_from_score(
        product.score,
        alerta=product.alerta,
        stock=product.stock,
        sales_60d=product.sales_60d,
    )
    product.priority = priority
    product.status = status


def _apply_vendidos_row(existing: Product, row: dict, match_kind: str):
    """Aplica um row vindo de planilha Vendidos sobre um produto existente."""
    prior_origem = existing.origem_importacao or ""
    if "estoque" in prior_origem:
        existing.origem_importacao = "vendidos+estoque"
    else:
        existing.origem_importacao = "vendidos"

    # Se o produto já tinha vendas vindas de outra aba vendidos, soma; senão substitui
    incoming_sales = int(row.get("sales_60d") or 0)
    if prior_origem == "vendidos" and (existing.sales_60d or 0) > 0 and incoming_sales > 0:
        existing.sales_60d = int(existing.sales_60d or 0) + incoming_sales
    elif incoming_sales > 0 or (existing.sales_60d or 0) == 0:
        existing.sales_60d = incoming_sales

    # Custo/preço vendidos são per-unidade calculados (Valor / Qtde): preferir vendidos
    if row.get("cost") is not None:
        existing.cost = row["cost"]
    if row.get("price") is not None:
        existing.price = row["price"]

    if not existing.name and row.get("name"):
        existing.name = row["name"]
    if not existing.brand and row.get("brand"):
        existing.brand = row["brand"]
    if not existing.sku and row.get("sku"):
        existing.sku = row["sku"]
        existing.sku_status = row.get("sku_status") or "presente"
    if not existing.ean and row.get("ean"):
        existing.ean = row["ean"]
    if not existing.nome_original and row.get("nome_original"):
        existing.nome_original = row["nome_original"]
    if not existing.nome_normalizado and row.get("nome_normalizado"):
        existing.nome_normalizado = row["nome_normalizado"]

    # match_status reflete a forma como pegamos. Se já era sku_match anteriormente, mantém.
    if match_kind == "sku_match" or existing.match_status == "sku_match":
        existing.match_status = "sku_match"
    elif match_kind == "nome_match_fraco" or existing.match_status == "nome_match_fraco":
        existing.match_status = "nome_match_fraco"


def _apply_estoque_row(existing: Product, row: dict, match_kind: str):
    """Aplica um row vindo de planilha Estoque sobre um produto existente (provavelmente vendidos)."""
    existing.stock = int(row.get("stock") or 0)
    if row.get("valor_total_estoque") is not None:
        existing.valor_total_estoque = row["valor_total_estoque"]
    # custo do estoque só preenche se vendidos estiver vazio
    if (existing.cost is None or existing.cost == 0) and row.get("cost") is not None:
        existing.cost = row["cost"]

    prior_origem = existing.origem_importacao or ""
    if "vendidos" in prior_origem:
        existing.origem_importacao = "vendidos+estoque"
    else:
        existing.origem_importacao = prior_origem or "estoque"
        if existing.origem_importacao not in ("estoque", "vendidos+estoque"):
            existing.origem_importacao = "vendidos+estoque" if "vendidos" in existing.origem_importacao else "estoque"

    if not existing.name and row.get("name"):
        existing.name = row["name"]
    if not existing.nome_original and row.get("nome_original"):
        existing.nome_original = row["nome_original"]
    if not existing.nome_normalizado and row.get("nome_normalizado"):
        existing.nome_normalizado = row["nome_normalizado"]
    if not existing.sku and row.get("sku"):
        existing.sku = row["sku"]
        existing.sku_status = row.get("sku_status") or "presente"

    if match_kind == "sku_match" or existing.match_status == "sku_match":
        existing.match_status = "sku_match"
    elif match_kind == "nome_match_fraco":
        existing.match_status = "nome_match_fraco"


@app.post("/upload-xlsx")
async def upload_xlsx(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Arquivo deve ser .xlsx")

    content = await file.read()
    rows, mapping, origem_arquivo = read_xlsx(content)

    inserted = 0
    updated = 0
    sku_matches = 0
    nome_matches = 0
    novos_so_estoque = 0
    novos_so_vendidos = 0
    touched_ids = set()

    for row in rows:
        sku = row.get("sku")
        nome_norm = row.get("nome_normalizado")
        existing, match_kind = _find_existing(db, sku, nome_norm)

        if existing:
            if (row.get("origem") or "") == "estoque":
                _apply_estoque_row(existing, row, match_kind)
            else:
                _apply_vendidos_row(existing, row, match_kind)

            if match_kind == "sku_match":
                sku_matches += 1
            elif match_kind == "nome_match_fraco":
                nome_matches += 1

            updated += 1
            touched_ids.add(existing.id)
        else:
            origem_row = row.get("origem") or "generico"
            initial_match = None
            if origem_row == "estoque":
                initial_match = "somente_estoque"
                novos_so_estoque += 1
            elif origem_row == "vendidos":
                novos_so_vendidos += 1

            new_prod = Product(
                name=row.get("name"),
                nome_original=row.get("nome_original"),
                nome_normalizado=row.get("nome_normalizado"),
                brand=row.get("brand"),
                sku=row.get("sku"),
                sku_status=row.get("sku_status") or "ausente",
                ean=row.get("ean"),
                stock=int(row.get("stock") or 0),
                cost=row.get("cost"),
                price=row.get("price"),
                sales_60d=int(row.get("sales_60d") or 0),
                valor_total_estoque=row.get("valor_total_estoque"),
                origem_importacao=origem_row,
                match_status=initial_match,
            )
            db.add(new_prod)
            db.flush()
            inserted += 1
            touched_ids.add(new_prod.id)

    # Se este import é de estoque, marcar vendidos não-tocados como sem_estoque_geral
    if origem_arquivo == "estoque":
        if touched_ids:
            leftover = db.query(Product).filter(~Product.id.in_(touched_ids)).all()
        else:
            leftover = db.query(Product).all()
        for p in leftover:
            origem_existing = p.origem_importacao or ""
            if "vendidos" in origem_existing and "estoque" not in origem_existing:
                if (p.stock or 0) == 0:
                    p.match_status = "sem_estoque_geral"

    # Recalcula métricas, alerta, score e priority para toda a base
    all_products = db.query(Product).all()
    for p in all_products:
        _refresh_metrics(p)

    db.commit()

    return {
        "imported": inserted + updated,
        "inserted": inserted,
        "updated": updated,
        "sku_matches": sku_matches,
        "nome_matches": nome_matches,
        "novos_so_estoque": novos_so_estoque,
        "novos_so_vendidos": novos_so_vendidos,
        "origem_arquivo": origem_arquivo,
        "merge_mode": origem_arquivo,
        "column_mapping": mapping,
        "total_after": db.query(Product).count(),
    }


@app.delete("/products")
def clear_products(db: Session = Depends(get_db)):
    deleted = db.query(Product).delete()
    db.commit()
    return {"deleted": deleted}


@app.get("/products")
def list_products(
    search: Optional[str] = None,
    in_stock: Optional[bool] = None,
    sold: Optional[bool] = None,
    min_score: Optional[float] = Query(default=None, ge=0, le=100),
    max_score: Optional[float] = Query(default=None, ge=0, le=100),
    status: Optional[str] = None,
    alerta: Optional[str] = None,
    match_status: Optional[str] = None,
    sku_status: Optional[str] = None,
    origem: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Product)

    if search:
        q = "%{0}%".format(search)
        query = query.filter(
            or_(Product.name.ilike(q), Product.brand.ilike(q), Product.sku.ilike(q), Product.ean.ilike(q))
        )
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
    if alerta:
        query = query.filter(Product.alerta == alerta)
    if match_status:
        query = query.filter(Product.match_status == match_status)
    if sku_status:
        query = query.filter(Product.sku_status == sku_status)
    if origem:
        query = query.filter(Product.origem_importacao == origem)

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
            "suggested_title": "{0} {1}".format(product.name or "Produto", product.brand or "").strip(),
            "base_description": (
                "{0} da marca {1}. "
                "Item com foco em giro e competitividade para marketplace.".format(
                    product.name or "Produto", product.brand or "não informada"
                )
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
