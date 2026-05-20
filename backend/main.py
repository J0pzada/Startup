import json
import secrets as _stdlib_secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

import secrets_store
from database import Base, SessionLocal, engine, ensure_columns, get_database_info, get_db
from importer import preview_xlsx, read_xlsx
from marketplace.amazon import AmazonAdapter
from marketplace.magalu import MagaluAdapter
from marketplace.mercadolivre import MercadoLivreAdapter, build_mercadolivre_query
from marketplace.shopee import ShopeeAdapter
from models import (
    MARKETPLACE_SNAPSHOT_EXTRA_COLUMNS,
    PRODUCT_EXTRA_COLUMNS,
    MarketplaceSnapshot,
    MarketplaceSnapshotItem,
    MercadoLivreAccount,
    Product,
)
from profit_calculator import calculate_profit
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
ensure_columns("marketplace_snapshots", MARKETPLACE_SNAPSHOT_EXTRA_COLUMNS)

mercadolivre_adapter = MercadoLivreAdapter()
adapters = [mercadolivre_adapter, ShopeeAdapter(), AmazonAdapter(), MagaluAdapter()]


def _resolve_active_ml_token():
    """Lê o access_token da conta Mercado Livre ativa via secret storage.

    Retorna (token, account_meta). Em caso de falha (sem conta, sem Vault,
    erro de leitura), retorna (None, None) — o adapter cai em mock.
    Nunca loga o valor do token.
    """
    if not secrets_store.is_cloud_secrets_enabled():
        return None, None
    db = SessionLocal()
    try:
        account = (
            db.query(MercadoLivreAccount)
            .filter(MercadoLivreAccount.is_active == True)  # noqa: E712
            .order_by(MercadoLivreAccount.updated_at.desc(), MercadoLivreAccount.id.desc())
            .first()
        )
        if not account or not account.token_secret_ref:
            return None, None
        try:
            token = secrets_store.read_secret(account.token_secret_ref)
        except (secrets_store.SecretStorageNotConfigured, secrets_store.SecretStorageError):
            return None, None
        meta = {
            "seller_user_id": account.seller_user_id,
            "nickname": account.nickname,
            "token_expires_at": account.token_expires_at.isoformat() if account.token_expires_at else None,
            "scope": account.scope,
            "site_id": account.site_id,
        }
        return token, meta
    finally:
        db.close()


mercadolivre_adapter.set_token_resolver(_resolve_active_ml_token)


class MercadoLivreAnalyzeRequest(BaseModel):
    limit: Optional[int] = 50
    force_refresh: bool = False


class MercadoLivreUrlAnalyzeRequest(BaseModel):
    url: str
    purchase_price: Optional[float] = None
    sale_price: Optional[float] = None
    monthly_sales: Optional[float] = None
    tax_percent: float = 4
    commission_percent: float = 12
    fixed_fee: float = 0
    shipping_cost: float = 0
    additional_cost: float = 0
    additional_cost_type: str = "value"
    free_shipping: bool = False
    listing_type: str = "classico"
    fiscal_regime: str = "simples"
    annual_revenue_bracket: str = "simples_ate_180k"
    limit: Optional[int] = 50


class ProfitCalculatorRequest(BaseModel):
    sale_price: float
    purchase_price: float
    monthly_sales: float = 1
    commission_percent: float = 12
    fixed_fee: float = 0
    shipping_cost: float = 0
    tax_percent: float = 4
    additional_cost: float = 0
    additional_cost_type: str = "value"
    free_shipping: bool = False
    listing_type: str = "classico"
    fiscal_regime: str = "simples"
    annual_revenue_bracket: str = "simples_ate_180k"


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


def serialize_marketplace_snapshot(snapshot: MarketplaceSnapshot):
    if not snapshot:
        return None
    raw_summary = {}
    if snapshot.raw_summary_json:
        try:
            raw_summary = json.loads(snapshot.raw_summary_json)
        except json.JSONDecodeError:
            raw_summary = {}

    return {
        "id": snapshot.id,
        "product_id": snapshot.product_id,
        "marketplace": snapshot.marketplace,
        "mode": snapshot.mode,
        "query": snapshot.query,
        "source_url": snapshot.source_url,
        "total_results": snapshot.total_results,
        "min_price": snapshot.min_price,
        "avg_price": snapshot.avg_price,
        "max_price": snapshot.max_price,
        "median_price": snapshot.median_price,
        "sellers_count": snapshot.sellers_count,
        "catalog_count": snapshot.catalog_count,
        "free_shipping_count": snapshot.free_shipping_count,
        "full_shipping_count": snapshot.full_shipping_count,
        "classic_count": snapshot.classic_count,
        "premium_count": snapshot.premium_count,
        "used_count": snapshot.used_count,
        "new_count": snapshot.new_count,
        "estimated_monthly_sales": snapshot.estimated_monthly_sales,
        "estimated_monthly_revenue": snapshot.estimated_monthly_revenue,
        "recommendation": snapshot.recommendation,
        "created_at": snapshot.created_at.isoformat() if snapshot.created_at else None,
        "summary": raw_summary,
    }


def serialize_marketplace_item(item: MarketplaceSnapshotItem):
    return {
        "id": item.id,
        "snapshot_id": item.snapshot_id,
        "external_id": item.external_id,
        "title": item.title,
        "price": item.price,
        "permalink": item.permalink,
        "seller_name": item.seller_name,
        "seller_id": item.seller_id,
        "seller_reputation": item.seller_reputation,
        "condition": item.condition,
        "listing_type": item.listing_type,
        "free_shipping": bool(item.free_shipping),
        "full_shipping": bool(item.full_shipping),
        "thumbnail": item.thumbnail,
        "sold_quantity": item.sold_quantity,
        "available_quantity": item.available_quantity,
        "category_id": item.category_id,
        "position": item.position,
    }


def _latest_ml_snapshot(db: Session, product_id: Optional[int] = None, source_url: Optional[str] = None):
    query = db.query(MarketplaceSnapshot).filter(MarketplaceSnapshot.marketplace == mercadolivre_adapter.marketplace_key)
    if product_id is not None:
        query = query.filter(MarketplaceSnapshot.product_id == product_id)
    if source_url:
        query = query.filter(MarketplaceSnapshot.source_url == source_url)
    return query.order_by(MarketplaceSnapshot.created_at.desc(), MarketplaceSnapshot.id.desc()).first()


def _snapshot_is_fresh(snapshot: MarketplaceSnapshot):
    if not snapshot or not snapshot.created_at:
        return False
    created_at = snapshot.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - created_at <= timedelta(hours=mercadolivre_adapter.cache_ttl_hours)


def _save_ml_snapshot(db: Session, analysis: dict, product_id: Optional[int] = None, source_url: Optional[str] = None):
    market = analysis.get("market_summary") or {}
    sales = analysis.get("sales_intelligence") or {}
    recommendation = analysis.get("recommendation") or {}
    db_product_id = product_id if product_id is not None else 0
    snapshot = MarketplaceSnapshot(
        product_id=db_product_id,
        marketplace=mercadolivre_adapter.marketplace_key,
        mode=analysis.get("mode") or analysis.get("source"),
        query=analysis.get("query_used"),
        source_url=source_url or analysis.get("source_url"),
        total_results=market.get("total_results") or analysis.get("total_results") or 0,
        min_price=market.get("min_price") or analysis.get("min_price"),
        avg_price=market.get("avg_price") or analysis.get("avg_price"),
        max_price=market.get("max_price") or analysis.get("max_price"),
        median_price=market.get("median_price") or analysis.get("median_price"),
        sellers_count=market.get("sellers_count") or analysis.get("sellers_count") or 0,
        catalog_count=market.get("catalog_count") or 0,
        free_shipping_count=market.get("free_shipping_count") or 0,
        full_shipping_count=market.get("full_shipping_count") or 0,
        classic_count=market.get("classic_count") or 0,
        premium_count=market.get("premium_count") or 0,
        used_count=market.get("used_count") or 0,
        new_count=market.get("new_count") or 0,
        estimated_monthly_sales=sales.get("estimated_total_sales") or analysis.get("estimated_monthly_sales"),
        estimated_monthly_revenue=sales.get("estimated_monthly_revenue") or analysis.get("estimated_monthly_revenue"),
        recommendation=recommendation.get("action") or analysis.get("recommendation_label"),
        raw_summary_json=json.dumps(analysis, ensure_ascii=False),
    )
    db.add(snapshot)
    db.flush()

    for item in (analysis.get("top_ads") or [])[:50]:
        db.add(
            MarketplaceSnapshotItem(
                snapshot_id=snapshot.id,
                external_id=item.get("external_id"),
                title=item.get("title"),
                price=item.get("price"),
                permalink=item.get("permalink"),
                seller_name=item.get("seller_name") or item.get("seller"),
                seller_id=item.get("seller_id"),
                seller_reputation=item.get("seller_reputation"),
                condition=item.get("condition"),
                listing_type=item.get("listing_type"),
                free_shipping=1 if item.get("free_shipping") else 0,
                full_shipping=1 if item.get("full_shipping") else 0,
                thumbnail=item.get("thumbnail"),
                sold_quantity=item.get("sold_quantity"),
                available_quantity=item.get("available_quantity"),
                category_id=item.get("category_id"),
                position=item.get("position"),
                raw_json=json.dumps(item.get("raw") or item, ensure_ascii=False),
            )
        )

    db.commit()
    db.refresh(snapshot)
    analysis["snapshot_id"] = snapshot.id
    analysis["snapshot_created_at"] = snapshot.created_at.isoformat() if snapshot.created_at else None
    return snapshot, analysis


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
    latest_ml = _latest_ml_snapshot(db, product_id=product.id)
    ml_summary = serialize_marketplace_snapshot(latest_ml)["summary"] if latest_ml else {}
    listing_quality = ml_summary.get("listing_quality") or {}
    price_intelligence = ml_summary.get("price_intelligence") or {}
    ml_keywords = listing_quality.get("suggested_search_terms") or []
    ml_terms = listing_quality.get("suggested_title_terms") or []

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
            "ml_insights": {
                "has_analysis": bool(latest_ml),
                "suggested_title_terms": ml_terms,
                "suggested_keywords": ml_keywords,
                "suggested_price": price_intelligence.get("suggested_competitive_price"),
                "strategy": (ml_summary.get("recommendation") or {}).get("action"),
            },
        },
    }


@app.get("/products/{product_id}/marketplaces")
def product_marketplaces(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    latest_ml = _latest_ml_snapshot(db, product_id=product.id)

    return {
        "items": [adapter.get_product_snapshot(product) for adapter in adapters],
        "mercadolivre": {
            "status": mercadolivre_adapter.mode,
            "configured": mercadolivre_adapter.configured,
            "enabled": mercadolivre_adapter.enabled,
            "query_preview": build_mercadolivre_query(product),
            "available_analyses": ["market_summary", "price_intelligence", "sales_intelligence", "competitors", "profit_calculator"],
            "latest_snapshot": serialize_marketplace_snapshot(latest_ml) if latest_ml else None,
        },
    }


@app.post("/products/{product_id}/marketplaces/mercadolivre/analyze")
def analyze_product_mercadolivre(
    product_id: int,
    payload: Optional[MercadoLivreAnalyzeRequest] = None,
    db: Session = Depends(get_db),
):
    payload = payload or MercadoLivreAnalyzeRequest()
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    latest = _latest_ml_snapshot(db, product_id=product.id)
    if latest and not payload.force_refresh and _snapshot_is_fresh(latest):
        cached = serialize_marketplace_snapshot(latest)["summary"]
        cached["cache_hit"] = True
        cached["snapshot_id"] = latest.id
        cached["snapshot_created_at"] = latest.created_at.isoformat() if latest.created_at else None
        return cached

    analysis = mercadolivre_adapter.analyze_product(product, limit=payload.limit)
    if analysis.get("valid"):
        _, analysis = _save_ml_snapshot(db, analysis, product_id=product.id)

    return analysis


@app.post("/marketplaces/mercadolivre/analyze-url")
def analyze_mercadolivre_url(payload: MercadoLivreUrlAnalyzeRequest, db: Session = Depends(get_db)):
    profit_result = None
    if payload.purchase_price is not None and payload.sale_price is not None:
        profit_result = calculate_profit(
            sale_price=payload.sale_price,
            purchase_price=payload.purchase_price,
            monthly_sales=payload.monthly_sales or 1,
            commission_percent=payload.commission_percent,
            fixed_fee=payload.fixed_fee,
            shipping_cost=payload.shipping_cost,
            tax_percent=payload.tax_percent,
            additional_cost=payload.additional_cost,
            additional_cost_type=payload.additional_cost_type,
            free_shipping=payload.free_shipping,
            listing_type=payload.listing_type,
            fiscal_regime=payload.fiscal_regime,
            annual_revenue_bracket=payload.annual_revenue_bracket,
        )

    analysis = mercadolivre_adapter.analyze_product_url(
        payload.url,
        limit=payload.limit,
        profit_inputs={**payload.model_dump(), "result": profit_result},
    )
    if analysis.get("valid"):
        _, analysis = _save_ml_snapshot(db, analysis, product_id=None, source_url=payload.url)
    return analysis


@app.get("/marketplaces/mercadolivre/snapshots/{snapshot_id}")
def get_mercadolivre_snapshot(snapshot_id: int, db: Session = Depends(get_db)):
    snapshot = db.query(MarketplaceSnapshot).filter(MarketplaceSnapshot.id == snapshot_id).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot não encontrado")
    items = (
        db.query(MarketplaceSnapshotItem)
        .filter(MarketplaceSnapshotItem.snapshot_id == snapshot.id)
        .order_by(MarketplaceSnapshotItem.position.asc(), MarketplaceSnapshotItem.id.asc())
        .all()
    )
    data = serialize_marketplace_snapshot(snapshot)
    data["items"] = [serialize_marketplace_item(item) for item in items]
    return data


@app.get("/marketplaces/mercadolivre/status")
def mercadolivre_status():
    status = mercadolivre_adapter.get_status()
    status["database"] = get_database_info()
    return status


# -------------------------------------------------------------------------
# Mercado Livre OAuth (cloud-ready, sem armazenar token local)
# -------------------------------------------------------------------------


@app.get("/mercadolivre/auth/url")
def mercadolivre_auth_url():
    state = _stdlib_secrets.token_urlsafe(16)
    info = mercadolivre_adapter.get_auth_url(state=state)
    # state é gerado por chamada; o frontend recebe e usa no fluxo OAuth.
    info["state"] = state
    return info


@app.get("/mercadolivre/auth/callback")
def mercadolivre_auth_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    db: Session = Depends(get_db),
):
    if not code:
        raise HTTPException(status_code=400, detail="Parâmetro 'code' ausente no callback.")
    if not mercadolivre_adapter.configured:
        raise HTTPException(status_code=400, detail="Mercado Livre OAuth não configurado no backend.")
    if not secrets_store.is_cloud_secrets_enabled():
        # Política firme: NÃO salvamos token localmente em hipótese alguma.
        raise HTTPException(
            status_code=503,
            detail=(
                "Secret storage cloud não configurado. Configure Supabase Vault "
                "(SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) antes de conectar o Mercado Livre."
            ),
        )

    try:
        token_payload = mercadolivre_adapter.exchange_code(code)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    access_token = token_payload.get("access_token")
    refresh_token = token_payload.get("refresh_token")
    expires_in = int(token_payload.get("expires_in") or 0)
    if not access_token:
        raise HTTPException(status_code=502, detail="Mercado Livre não retornou access_token.")

    try:
        access_ref = secrets_store.save_secret(
            "mercadolivre_access_token", access_token, "MapaSeller ML access_token"
        )
        refresh_ref = None
        if refresh_token:
            refresh_ref = secrets_store.save_secret(
                "mercadolivre_refresh_token", refresh_token, "MapaSeller ML refresh_token"
            )
    except (secrets_store.SecretStorageNotConfigured, secrets_store.SecretStorageError) as exc:
        raise HTTPException(status_code=502, detail="Falha ao guardar token no Vault: {0}".format(exc))

    expires_at = datetime.now(timezone.utc) + timedelta(seconds=max(60, expires_in)) if expires_in else None

    account = (
        db.query(MercadoLivreAccount)
        .filter(MercadoLivreAccount.seller_user_id == str(token_payload.get("user_id") or ""))
        .first()
    )
    if not account:
        account = MercadoLivreAccount(site_id=mercadolivre_adapter.site_id)
        db.add(account)

    account.seller_user_id = str(token_payload.get("user_id") or "") or None
    account.scope = token_payload.get("scope")
    account.token_secret_ref = access_ref
    if refresh_ref:
        account.refresh_token_secret_ref = refresh_ref
    account.token_expires_at = expires_at
    account.is_active = True
    db.commit()
    db.refresh(account)

    return {
        "ok": True,
        "connected": True,
        "site_id": account.site_id,
        "seller_user_id": account.seller_user_id,
        "nickname": account.nickname,
        "token_expires_at": account.token_expires_at.isoformat() if account.token_expires_at else None,
        "state": state,
    }


@app.post("/mercadolivre/auth/refresh")
def mercadolivre_auth_refresh(db: Session = Depends(get_db)):
    if not mercadolivre_adapter.configured:
        raise HTTPException(status_code=400, detail="Mercado Livre OAuth não configurado no backend.")
    if not secrets_store.is_cloud_secrets_enabled():
        raise HTTPException(status_code=503, detail="Secret storage cloud não configurado.")

    account = (
        db.query(MercadoLivreAccount)
        .filter(MercadoLivreAccount.is_active == True)  # noqa: E712
        .order_by(MercadoLivreAccount.updated_at.desc(), MercadoLivreAccount.id.desc())
        .first()
    )
    if not account or not account.refresh_token_secret_ref:
        raise HTTPException(status_code=404, detail="Nenhuma conta Mercado Livre conectada para renovar.")

    try:
        refresh_token = secrets_store.read_secret(account.refresh_token_secret_ref)
    except (secrets_store.SecretStorageNotConfigured, secrets_store.SecretStorageError) as exc:
        raise HTTPException(status_code=502, detail="Falha ao ler refresh_token: {0}".format(exc))

    try:
        token_payload = mercadolivre_adapter.refresh_tokens(refresh_token)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    new_access = token_payload.get("access_token")
    new_refresh = token_payload.get("refresh_token")
    expires_in = int(token_payload.get("expires_in") or 0)
    if not new_access:
        raise HTTPException(status_code=502, detail="Mercado Livre não retornou novo access_token.")

    try:
        if account.token_secret_ref:
            secrets_store.update_secret(account.token_secret_ref, new_access)
        else:
            account.token_secret_ref = secrets_store.save_secret(
                "mercadolivre_access_token", new_access, "MapaSeller ML access_token"
            )
        if new_refresh:
            if account.refresh_token_secret_ref:
                secrets_store.update_secret(account.refresh_token_secret_ref, new_refresh)
            else:
                account.refresh_token_secret_ref = secrets_store.save_secret(
                    "mercadolivre_refresh_token", new_refresh, "MapaSeller ML refresh_token"
                )
    except (secrets_store.SecretStorageNotConfigured, secrets_store.SecretStorageError) as exc:
        raise HTTPException(status_code=502, detail="Falha ao gravar novo token: {0}".format(exc))

    account.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=max(60, expires_in)) if expires_in else None
    account.scope = token_payload.get("scope") or account.scope
    db.commit()
    return {
        "ok": True,
        "token_expires_at": account.token_expires_at.isoformat() if account.token_expires_at else None,
    }


@app.post("/calculator/profit")
def calculator_profit(payload: ProfitCalculatorRequest):
    return calculate_profit(**payload.model_dump())
