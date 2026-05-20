import json
import math
import os
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from statistics import mean, median
from types import SimpleNamespace
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, unquote, urlencode, urlparse
from urllib.request import Request, urlopen

from marketplace.base import MarketplaceAdapter
from profit_calculator import calculate_profit


MAX_QUERY_LENGTH = 72
DEFAULT_MAX_RESULTS = 50
NOISE_TOKENS = {
    "APLICACAO",
    "APLICACOES",
    "COMPATIVEL",
    "FREE",
    "GRATIS",
    "LINHA",
    "MODELO",
    "MODELOS",
    "PARA",
    "PECA",
    "PECAS",
    "PROMOCAO",
    "VEICULO",
    "VEICULOS",
}


def _env_bool(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def _env_int(name, default):
    try:
        return int(os.getenv(name, default) or default)
    except (TypeError, ValueError):
        return default


def _env_float(name, default):
    try:
        return float(os.getenv(name, default) or default)
    except (TypeError, ValueError):
        return default


def _strip_accents(value):
    normalized = unicodedata.normalize("NFKD", value or "")
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def _round(value, digits=2):
    if value is None:
        return None
    return round(float(value), digits)


def _clean_query_text(value):
    text = _strip_accents(value or "").upper()
    text = re.sub(r"[^A-Z0-9./ -]+", " ", text)
    text = re.sub(r"\b(APLICACAO|APLICACOES|COMPATIVEL|MODELO|MODELOS|VEICULO|VEICULOS)\b.*$", "", text)
    text = re.sub(r"[-_/]+", " ", text)
    tokens = []
    for token in text.split():
        compact = token.strip(".,;:")
        if not compact or compact in NOISE_TOKENS:
            continue
        if len(compact) > 24:
            continue
        tokens.append(compact)
    cleaned = " ".join(tokens[:9])
    return cleaned[:MAX_QUERY_LENGTH].strip()


def _clean_slug_query(value):
    text = _strip_accents(value or "").lower()
    text = re.sub(r"\.[a-z0-9]{2,5}$", "", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    tokens = [token for token in text.split() if token and not token.startswith("mlb")]
    return " ".join(tokens)[:MAX_QUERY_LENGTH].strip()


def _display_query(value):
    return (value or "").strip()


def is_reliable_sku(product):
    sku = (getattr(product, "sku", None) or "").strip()
    sku_status = (getattr(product, "sku_status", None) or "").strip().lower()
    if not sku or sku_status in ("ausente", "codigo_suspeito"):
        return False
    return len(sku) >= 3


def build_search_query(product):
    name = getattr(product, "name", None) or getattr(product, "nome_original", None) or ""
    query = _clean_query_text(name)
    if query:
        return query
    if is_reliable_sku(product):
        return _clean_query_text(getattr(product, "sku", ""))
    return _clean_query_text(getattr(product, "brand", "") or "produto")


def build_mercadolivre_query(product):
    return build_search_query(product)


def build_mercadolivre_sku_query(product):
    if not is_reliable_sku(product):
        return None
    return _clean_query_text(getattr(product, "sku", ""))


def parse_mercadolivre_url(url):
    original_url = (url or "").strip()
    if not original_url:
        return {"original_url": original_url, "item_id": None, "product_id": None, "slug": "", "inferred_query": "", "valid": False}

    parsed = urlparse(original_url)
    host = parsed.netloc.lower()
    path = unquote(parsed.path or "")
    valid_host = "mercadolivre" in host or "mercadolibre" in host or host in ("produto.mercadolivre.com.br", "www.mercadolivre.com.br")
    item_match = re.search(r"\b(MLBU?[-]?\d{6,})\b", original_url, re.IGNORECASE)
    product_match = re.search(r"/p/(MLB\d+)", path, re.IGNORECASE)
    up_match = re.search(r"/up/(MLBU?\d+)", path, re.IGNORECASE)

    query_params = parse_qs(parsed.query)
    item_id = (item_match.group(1).replace("-", "").upper() if item_match else None)
    if not item_id and up_match:
        item_id = up_match.group(1).replace("-", "").upper()
    product_id = product_match.group(1).upper() if product_match else None
    if not item_id:
        item_id = (query_params.get("item_id") or query_params.get("itemId") or [None])[0]
        item_id = item_id.replace("-", "").upper() if item_id else None

    technical_parts = {"p", "jm", "mlb", "up"}
    slug_parts = [part for part in path.split("/") if part and part.lower() not in technical_parts]
    slug = ""
    for part in slug_parts:
        if not re.match(r"^MLBU?[-]?\d+$", part, re.IGNORECASE):
            slug = part
            break
    slug = slug.replace("-", " ")
    inferred_query = _clean_slug_query(slug)

    return {
        "original_url": original_url,
        "item_id": item_id,
        "product_id": product_id,
        "slug": slug,
        "inferred_query": inferred_query,
        "valid": bool(valid_host and (item_id or product_id or inferred_query)),
    }


def safe_fetch_json(url, params=None, headers=None, timeout=10):
    query = urlencode(params or {})
    full_url = "{0}?{1}".format(url, query) if query else url
    safe_headers = {"Accept": "application/json", "User-Agent": "MapaSeller/0.2"}
    safe_headers.update(headers or {})
    request = Request(full_url, headers=safe_headers)
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


class MercadoLivreAdapter(MarketplaceAdapter):
    marketplace_name = "Mercado Livre"
    marketplace_key = "mercadolivre"

    # TODO live Mercado Livre v1:
    # - search live: keep in search_market() via /sites/{site_id}/search, with timeout, limit cap and token-safe headers.
    # - item detail live: keep in _product_from_url() via /items/{item_id}, never logging Authorization.
    # - product/catalog live: keep in _product_from_url() via /products/{product_id}, falling back cleanly to query mock.
    # - similar products live: extend get_similar_products() with catalog/category signals after the base item/search response is normalized.
    # - seller reputation live: enrich normalize_ml_item() from official seller fields or a controlled seller lookup cache.
    # - cache snapshot: keep persistence in main._save_ml_snapshot(); add cache-hit checks before every live call path.

    def __init__(self):
        self.enabled = _env_bool("MERCADOLIVRE_ENABLED", False)
        self.site_id = os.getenv("MERCADOLIVRE_SITE_ID", "MLB").strip() or "MLB"
        self.client_id = os.getenv("MERCADOLIVRE_CLIENT_ID", "").strip()
        self.client_secret = os.getenv("MERCADOLIVRE_CLIENT_SECRET", "").strip()
        self.redirect_uri = os.getenv("MERCADOLIVRE_REDIRECT_URI", "").strip()
        self.fallback_to_mock = _env_bool("MERCADOLIVRE_FALLBACK_TO_MOCK", True)
        self.max_results = max(1, min(_env_int("MERCADOLIVRE_MAX_RESULTS", DEFAULT_MAX_RESULTS), 50))
        timeout_default = os.getenv("MARKETPLACE_TIMEOUT_SECONDS", "10")
        self.timeout_seconds = _env_float("MERCADOLIVRE_TIMEOUT_SECONDS", timeout_default)
        self.cache_ttl_hours = max(1, _env_int("MERCADOLIVRE_CACHE_TTL_HOURS", 24))
        # Token resolver é injetado pelo main em runtime (lê do Vault via
        # backend/secrets_store.py + conta ativa em mercadolivre_accounts).
        # Default: None — sem conta conectada, força mock.
        self._token_resolver = None

    def set_token_resolver(self, resolver):
        """Injeta uma função que retorna (access_token, account_meta) ou (None, None)."""
        self._token_resolver = resolver

    def _current_access_token(self):
        if self._token_resolver is None:
            return None, None
        try:
            return self._token_resolver()
        except Exception:
            # Nunca propagar exceção do secret storage para a UI.
            return None, None

    @property
    def configured(self):
        # 'configured' agora significa: backend tem o suficiente para OAuth.
        return bool(self.site_id and self.client_id and self.client_secret and self.redirect_uri)

    @property
    def mode(self):
        if not (self.enabled and self.configured):
            return "mock"
        token, _ = self._current_access_token()
        if not token:
            return "mock"
        return "live"

    @property
    def connected(self):
        token, _ = self._current_access_token()
        return bool(token)

    def get_status(self):
        from secrets_store import is_cloud_secrets_enabled
        token, account = self._current_access_token()
        return {
            "marketplace": self.marketplace_key,
            "enabled": self.enabled,
            "configured": self.configured,
            "connected": bool(token),
            "mode": self.mode,
            "site_id": self.site_id,
            "client_id_present": bool(self.client_id),
            "client_secret_present": bool(self.client_secret),
            "redirect_uri": self.redirect_uri or None,
            "cache_ttl_hours": self.cache_ttl_hours,
            "max_results": self.max_results,
            "fallback_to_mock": self.fallback_to_mock,
            "secret_storage": "configured" if is_cloud_secrets_enabled() else "not_configured",
            "seller_user_id": (account or {}).get("seller_user_id"),
            "nickname": (account or {}).get("nickname"),
            "token_expires_at": (account or {}).get("token_expires_at"),
        }

    def get_auth_url(self, state=None):
        """Monta o authorization_url OAuth do Mercado Livre.

        Não inclui client_secret. Retorna `configured=False` se faltar
        configuração no backend.
        """
        if not self.configured:
            return {
                "configured": False,
                "authorization_url": None,
                "redirect_uri": self.redirect_uri or None,
                "mode": self.mode,
                "reason": "Configure MERCADOLIVRE_CLIENT_ID, MERCADOLIVRE_CLIENT_SECRET e MERCADOLIVRE_REDIRECT_URI no backend.",
            }
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
        }
        if state:
            params["state"] = state
        base = "https://auth.mercadolivre.com.br/authorization"
        return {
            "configured": True,
            "authorization_url": "{0}?{1}".format(base, urlencode(params)),
            "redirect_uri": self.redirect_uri,
            "mode": self.mode,
        }

    def exchange_code(self, code):
        """Troca code por tokens chamando o endpoint oficial do Mercado Livre.

        Retorna um dict com access_token, refresh_token, expires_in, user_id,
        scope. Nunca loga o token. Se faltar configuração, levanta ValueError.
        """
        if not self.configured:
            raise ValueError("Mercado Livre OAuth não configurado no backend.")
        payload = {
            "grant_type": "authorization_code",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": code,
            "redirect_uri": self.redirect_uri,
        }
        return self._token_request(payload)

    def refresh_tokens(self, refresh_token):
        if not self.configured:
            raise ValueError("Mercado Livre OAuth não configurado no backend.")
        payload = {
            "grant_type": "refresh_token",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": refresh_token,
        }
        return self._token_request(payload)

    def _token_request(self, payload):
        import urllib.request
        import urllib.parse

        data = urllib.parse.urlencode(payload).encode("utf-8")
        request = urllib.request.Request(
            "https://api.mercadolibre.com/oauth/token",
            data=data,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "MapaSeller/0.2",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            raise RuntimeError("Mercado Livre OAuth retornou HTTP {0}.".format(exc.code))
        except (URLError, TimeoutError, ValueError, json.JSONDecodeError):
            raise RuntimeError("Falha ao trocar code por token no Mercado Livre.")

    def get_product_snapshot(self, product):
        return {
            "marketplace": self.marketplace_name,
            "status": self.mode,
            "suggested_price": round((product.price or 0) * 1.03, 2) if product.price else None,
            "estimated_fee_pct": 16,
            "competition_level": "alto",
            "notes": "Mock local: sem consulta externa." if self.mode == "mock" else "Integração Mercado Livre habilitada.",
        }

    def analyze_product(self, product, limit=None):
        query = build_search_query(product)
        results, source, error = self.search_market(product, limit=limit)
        analysis = self._build_analysis(product=product, query=query, results=results, mode=source)
        monthly_sales = max(float(getattr(product, "sales_60d", 0) or 0) / 2, 1)
        if getattr(product, "price", None) is not None and getattr(product, "cost", None) is not None:
            analysis["profit_calculation"] = calculate_profit(
                sale_price=getattr(product, "price"),
                purchase_price=getattr(product, "cost"),
                monthly_sales=monthly_sales,
                commission_percent=12,
                tax_percent=4,
                shipping_cost=0,
                additional_cost=0,
                listing_type="classico",
            )
        analysis["analysis_context"] = {
            "origin": "internal_product",
            "origin_label": "Produto interno",
            "mode": source,
            "mode_label": "Dados reais Mercado Livre" if source == "live" else "Análise simulada",
            "market_data_label": "Dados reais Mercado Livre" if source == "live" else "Dados simulados/mock do Mercado Livre",
            "calculator_label": "Calculadora estimada com dados internos",
            "product_name": getattr(product, "name", None),
            "query_used": query,
            "source_url": None,
            "internal_product_id": getattr(product, "id", None),
            "item_id": None,
            "product_id": None,
        }
        if error:
            analysis["error"] = error
            analysis["notes"] = "{0} Exibindo fallback mockado.".format(error)
        return analysis

    def analyze_product_url(self, url, limit=None, profit_inputs=None):
        parsed = parse_mercadolivre_url(url)
        if not parsed["valid"]:
            product = SimpleNamespace(name="Produto Mercado Livre", sku=None, sku_status="ausente", cost=None, price=None, stock=0, sales_60d=0)
            analysis = self._build_analysis(product=product, query="", results=self._mock_results(product, "PRODUTO MERCADO LIVRE", limit or 12), mode="mock")
            analysis["valid"] = False
            analysis["url_parse"] = parsed
            analysis["error"] = "Link do Mercado Livre inválido ou incompleto."
            return analysis

        product_data = self._product_from_url(parsed)
        query = product_data.get("query") or parsed["inferred_query"] or "produto mercado livre"
        product = SimpleNamespace(
            name=query,
            sku=parsed.get("item_id") or parsed.get("product_id"),
            sku_status="presente",
            cost=None,
            price=(profit_inputs or {}).get("sale_price"),
            stock=0,
            sales_60d=(profit_inputs or {}).get("monthly_sales") or 0,
        )
        results, source, error = self.search_market(product, limit=limit, query_override=query)
        analysis = self._build_analysis(product=product, query=query, results=results, mode=source, source_url=parsed["original_url"])
        analysis["url_parse"] = parsed
        analysis["base_product"] = product_data
        analysis["analysis_context"] = {
            "origin": "mercadolivre_url",
            "origin_label": "Link Mercado Livre",
            "mode": source,
            "mode_label": "Dados reais Mercado Livre" if source == "live" else "Análise simulada",
            "market_data_label": "Dados reais Mercado Livre" if source == "live" else "Dados simulados/mock do Mercado Livre",
            "calculator_label": "Calculadora estimada com dados manuais",
            "product_name": product_data.get("title") or query,
            "query_used": query,
            "source_url": parsed["original_url"],
            "internal_product_id": None,
            "item_id": parsed.get("item_id"),
            "product_id": parsed.get("product_id"),
            "slug": parsed.get("slug"),
        }
        if profit_inputs:
            analysis["profit_calculation"] = profit_inputs.get("result")
        if error:
            analysis["error"] = error
            analysis["notes"] = "{0} Exibindo fallback mockado.".format(error)
        return analysis

    def search_market(self, product, limit=None, query_override=None):
        query = query_override or build_search_query(product)
        safe_limit = max(1, min(int(limit or self.max_results), self.max_results, 50))
        token, _ = self._current_access_token()
        # Só vai live se: enabled + configured + secret storage devolveu token.
        if not (self.enabled and self.configured and token):
            return self._mock_results(product, query, safe_limit), "mock", None

        try:
            headers = {"Authorization": "Bearer {0}".format(token)}
            payload = safe_fetch_json(
                "https://api.mercadolibre.com/sites/{0}/search".format(self.site_id),
                params={"q": query, "limit": safe_limit},
                headers=headers,
                timeout=self.timeout_seconds,
            )
            return [self.normalize_ml_item(item, index) for index, item in enumerate(payload.get("results") or [])], "live", None
        except HTTPError as exc:
            message = "Mercado Livre limitou temporariamente as consultas." if exc.code == 429 else "Mercado Livre retornou HTTP {0}.".format(exc.code)
            if not self.fallback_to_mock:
                return [], "error", message
            return self._mock_results(product, query, safe_limit), "mock", message
        except (URLError, TimeoutError, ValueError, json.JSONDecodeError):
            if not self.fallback_to_mock:
                return [], "error", "Não foi possível consultar o Mercado Livre agora."
            return self._mock_results(product, query, safe_limit), "mock", "Não foi possível consultar o Mercado Livre agora."

    def get_similar_products(self, product_or_url):
        if isinstance(product_or_url, str):
            parsed = parse_mercadolivre_url(product_or_url)
            query = parsed.get("inferred_query") or "produto mercado livre"
            product = SimpleNamespace(name=query, sku=None, sku_status="ausente", price=None, cost=None)
        else:
            product = product_or_url
            query = build_search_query(product)
        results, _, _ = self.search_market(product, limit=12)
        return self._similar_products(results, query)

    def summarize_competitors(self, results):
        sellers = defaultdict(lambda: {"seller": "", "seller_id": None, "items": 0, "avg_price": 0, "estimated_sales": 0, "reputation": None})
        for item in results:
            key = item.get("seller_id") or item.get("seller") or "sem_vendedor"
            sellers[key]["seller"] = item.get("seller") or "Vendedor não informado"
            sellers[key]["seller_id"] = item.get("seller_id")
            sellers[key]["reputation"] = item.get("seller_reputation")
            sellers[key]["items"] += 1
            sellers[key]["avg_price"] += item.get("price") or 0
            sellers[key]["estimated_sales"] += item.get("sold_quantity") or 0
        output = []
        for seller in sellers.values():
            seller["avg_price"] = _round(seller["avg_price"] / seller["items"]) if seller["items"] else None
            output.append(seller)
        return sorted(output, key=lambda item: item["estimated_sales"], reverse=True)[:10]

    def calculate_price_intelligence(self, product, results):
        prices = [item["price"] for item in results if item.get("price") is not None]
        market_avg = mean(prices) if prices else None
        market_min = min(prices) if prices else None
        market_max = max(prices) if prices else None
        market_median = median(prices) if prices else None
        internal_price = getattr(product, "price", None)
        internal_cost = getattr(product, "cost", None)
        difference = (float(internal_price) - float(market_avg)) if internal_price is not None and market_avg else None
        difference_pct = (difference / market_avg * 100) if difference is not None and market_avg else None
        internal_margin = ((internal_price - internal_cost) / internal_price * 100) if internal_price and internal_cost else None
        suggested_competitive = market_median if market_median else market_avg
        suggested_aggressive = market_min * 0.99 if market_min else None
        suggested_conservative = market_avg * 1.04 if market_avg else None
        alert = "sem referência de mercado"
        if difference_pct is not None:
            if difference_pct > 8:
                alert = "preço interno acima do mercado"
            elif difference_pct < -8:
                alert = "preço interno abaixo do mercado"
            else:
                alert = "preço interno competitivo"
        return {
            "internal_price": _round(internal_price),
            "internal_cost": _round(internal_cost),
            "internal_margin_percent": _round(internal_margin),
            "market_avg_price": _round(market_avg),
            "difference_value": _round(difference),
            "difference_percent": _round(difference_pct),
            "suggested_conservative_price": _round(suggested_conservative),
            "suggested_competitive_price": _round(suggested_competitive),
            "suggested_aggressive_price": _round(suggested_aggressive),
            "ideal_entry_range": [_round(suggested_aggressive), _round(suggested_conservative)],
            "price_alert": alert,
            "min_price": _round(market_min),
            "median_price": _round(market_median),
            "max_price": _round(market_max),
        }

    def calculate_sales_estimate(self, results):
        sales = [int(item.get("sold_quantity") or 0) for item in results]
        prices = [float(item.get("price") or 0) for item in results]
        total_sales = sum(sales)
        total_revenue = sum((item.get("price") or 0) * (item.get("sold_quantity") or 0) for item in results)
        avg_sales = total_sales / len(results) if results else 0
        attractiveness = "baixa"
        if total_sales >= 250 or avg_sales >= 20:
            attractiveness = "alta"
        elif total_sales >= 80 or avg_sales >= 8:
            attractiveness = "média"
        competition = "baixa" if len(results) < 8 else "média" if len(results) < 24 else "alta"
        return {
            "estimated_total_sales": int(total_sales),
            "avg_sales_per_listing": _round(avg_sales),
            "estimated_total_revenue": _round(total_revenue),
            "estimated_monthly_revenue": _round(total_revenue),
            "avg_ticket": _round(mean(prices)) if prices else None,
            "attractiveness_rank": attractiveness,
            "competition_level": competition,
        }

    def calculate_listing_quality(self, results):
        words = []
        brands = []
        variations = []
        for item in results:
            title = _clean_query_text(item.get("title") or "").upper()
            tokens = [token for token in title.split() if len(token) > 2 and token not in NOISE_TOKENS]
            words.extend(tokens)
            if tokens:
                brands.append(tokens[0])
            variations.extend([token for token in tokens if re.search(r"\d", token)])
        common_words = [word for word, _ in Counter(words).most_common(12)]
        common_brands = [word for word, _ in Counter(brands).most_common(6)]
        common_variations = [word for word, _ in Counter(variations).most_common(8)]
        return {
            "top_title_terms": common_words,
            "recurring_keywords": common_words[:8],
            "detected_brands": common_brands,
            "common_variations": common_variations,
            "suggested_title_terms": common_words[:6],
            "suggested_search_terms": common_words[:10],
        }

    def generate_market_recommendation(self, product, analysis):
        price = analysis["price_intelligence"]
        sales = analysis["sales_intelligence"]
        stock = getattr(product, "stock", 0) or 0
        action = "anunciar agora"
        risks = []
        next_steps = ["validar compatibilidade", "testar título com termos recorrentes", "acompanhar preço médio em novo snapshot"]
        if stock <= 0:
            action = "repor antes de anunciar"
            risks.append("estoque interno insuficiente")
        elif price["difference_percent"] is not None and price["difference_percent"] > 12:
            action = "revisar preço"
            risks.append("preço interno acima da média do Mercado Livre")
        elif price["internal_margin_percent"] is not None and price["internal_margin_percent"] < 18:
            action = "buscar fornecedor melhor"
            risks.append("margem interna apertada")
        elif sales["competition_level"] == "alta" and sales["attractiveness_rank"] == "baixa":
            action = "evitar por enquanto"
            risks.append("muita oferta com baixa tração estimada")
        justification = "Mercado com concorrência {0}, ticket médio {1} e atratividade {2}.".format(
            sales["competition_level"],
            price["market_avg_price"],
            sales["attractiveness_rank"],
        )
        return {
            "action": action,
            "short_justification": justification,
            "risks": risks or ["validar aplicação e custos antes de escalar"],
            "next_steps": next_steps,
        }

    def normalize_ml_item(self, raw_item, position=0):
        seller = raw_item.get("seller") or {}
        if not isinstance(seller, dict):
            seller = {"id": seller}
        shipping = raw_item.get("shipping") or {}
        seller_reputation = seller.get("seller_reputation") or {}
        reputation_level = seller_reputation.get("level_id") if isinstance(seller_reputation, dict) else seller_reputation
        sold_quantity = raw_item.get("sold_quantity")
        if sold_quantity is None:
            sold_quantity = raw_item.get("initial_quantity") or 0
        return {
            "external_id": raw_item.get("id"),
            "title": raw_item.get("title"),
            "price": raw_item.get("price"),
            "permalink": raw_item.get("permalink"),
            "seller": seller.get("nickname") or str(seller.get("id") or "") or None,
            "seller_name": seller.get("nickname") or str(seller.get("id") or "") or None,
            "seller_id": str(seller.get("id")) if seller.get("id") else None,
            "seller_reputation": reputation_level,
            "condition": raw_item.get("condition"),
            "listing_type": raw_item.get("listing_type_id"),
            "free_shipping": bool(shipping.get("free_shipping")),
            "full_shipping": "fulfillment" in (shipping.get("logistic_type") or ""),
            "thumbnail": raw_item.get("thumbnail"),
            "sold_quantity": int(sold_quantity or 0),
            "available_quantity": raw_item.get("available_quantity"),
            "category_id": raw_item.get("category_id"),
            "catalog_product_id": raw_item.get("catalog_product_id"),
            "position": position + 1,
            "raw": raw_item,
        }

    def _build_analysis(self, product, query, results, mode, source_url=None):
        now = datetime.now(timezone.utc).isoformat()
        market_summary = self._market_summary(query, results, mode, now)
        price_intelligence = self.calculate_price_intelligence(product, results)
        sales_intelligence = self.calculate_sales_estimate(results)
        listing_quality = self.calculate_listing_quality(results)
        competitor_intelligence = {
            "top_ads": results[:10],
            "top_sellers": self.summarize_competitors(results),
            "lowest_price_ad": min(results, key=lambda item: item.get("price") or math.inf) if results else None,
            "highest_price_ad": max(results, key=lambda item: item.get("price") or 0) if results else None,
            "best_price_shipping_ads": sorted(results, key=lambda item: ((item.get("price") or math.inf), not item.get("free_shipping")))[:8],
            "similar_direct_ads": self._similar_ads(results, query, direct=True),
            "similar_products": self._similar_products(results, query),
        }
        analysis_seed = {
            "price_intelligence": price_intelligence,
            "sales_intelligence": sales_intelligence,
        }
        recommendation = self.generate_market_recommendation(product, analysis_seed)
        charts = self._charts(results, market_summary)

        return {
            "marketplace": self.marketplace_name,
            "marketplace_key": self.marketplace_key,
            "source": mode,
            "mode": mode,
            "status": mode,
            "valid": True,
            "query_used": query,
            "source_url": source_url,
            "analyzed_at": now,
            "market_summary": market_summary,
            "price_intelligence": price_intelligence,
            "sales_intelligence": sales_intelligence,
            "competitor_intelligence": competitor_intelligence,
            "listing_quality": listing_quality,
            "recommendation": recommendation,
            "charts": charts,
            "top_ads": competitor_intelligence["top_ads"],
            "similar_products": competitor_intelligence["similar_products"],
            "total_results": market_summary["total_results"],
            "min_price": market_summary["min_price"],
            "avg_price": market_summary["avg_price"],
            "median_price": market_summary["median_price"],
            "max_price": market_summary["max_price"],
            "sellers_count": market_summary["sellers_count"],
            "internal_price": price_intelligence["internal_price"],
            "difference_vs_avg": price_intelligence["difference_value"],
            "recommendation_label": recommendation["action"],
            "recommendation_text": recommendation["short_justification"],
            "estimated_monthly_sales": sales_intelligence["estimated_total_sales"],
            "estimated_monthly_revenue": sales_intelligence["estimated_monthly_revenue"],
        }

    def _market_summary(self, query, results, mode, now):
        prices = [item["price"] for item in results if item.get("price") is not None]
        categories = Counter([item.get("category_id") for item in results if item.get("category_id")])
        sellers = {item.get("seller_id") or item.get("seller") for item in results if item.get("seller_id") or item.get("seller")}
        return {
            "query": query,
            "total_results": len(results),
            "analyzed_listings": len(results),
            "sellers_count": len(sellers),
            "min_price": _round(min(prices)) if prices else None,
            "avg_price": _round(mean(prices)) if prices else None,
            "median_price": _round(median(prices)) if prices else None,
            "max_price": _round(max(prices)) if prices else None,
            "price_range": _round(max(prices) - min(prices)) if prices else None,
            "price_concentration": self._price_concentration(prices),
            "free_shipping_count": len([item for item in results if item.get("free_shipping")]),
            "full_shipping_count": len([item for item in results if item.get("full_shipping")]),
            "new_count": len([item for item in results if item.get("condition") == "new"]),
            "used_count": len([item for item in results if item.get("condition") == "used"]),
            "classic_count": len([item for item in results if item.get("listing_type") == "gold_special"]),
            "premium_count": len([item for item in results if item.get("listing_type") == "gold_pro"]),
            "catalog_count": len([item for item in results if item.get("catalog_product_id")]),
            "categories": [{"category_id": key, "count": value} for key, value in categories.most_common(8)],
            "analyzed_at": now,
            "mode": mode,
        }

    def _price_concentration(self, prices):
        if not prices:
            return None
        avg = mean(prices)
        if avg <= 0:
            return None
        near_avg = len([price for price in prices if abs(price - avg) / avg <= 0.1])
        return round((near_avg / len(prices)) * 100, 2)

    def _similar_ads(self, results, query, direct=False):
        query_terms = set(_clean_slug_query(query).upper().split() or _clean_query_text(query).split())
        output = []
        for item in results:
            title_terms = set(_clean_query_text(item.get("title") or "").split())
            score = int((len(query_terms & title_terms) / max(len(query_terms), 1)) * 100)
            item_copy = dict(item)
            item_copy["similarity_score"] = score
            item_copy["similarity_badge"] = "concorrente direto" if score >= 55 else "similar amplo"
            if not direct or score >= 45:
                output.append(item_copy)
        return sorted(output, key=lambda item: item["similarity_score"], reverse=True)[:10]

    def _similar_products(self, results, query):
        return self._similar_ads(results, query, direct=False)[:12]

    def _charts(self, results, summary):
        prices = [item["price"] for item in results if item.get("price") is not None]
        min_price = min(prices) if prices else 0
        max_price = max(prices) if prices else 0
        bucket_size = max((max_price - min_price) / 5, 1)
        buckets = []
        for index in range(5):
            start = min_price + (bucket_size * index)
            end = start + bucket_size
            count = len([price for price in prices if start <= price < end or (index == 4 and price <= end)])
            buckets.append({"name": "{0}-{1}".format(int(start), int(end)), "value": count})
        seller_columns = [
            {"name": seller["seller"][:18], "value": seller["estimated_sales"]}
            for seller in self.summarize_competitors(results)[:6]
        ]
        avg = summary.get("avg_price") or 0
        trend = [
            {"name": "D-4", "value": _round(avg * 0.98) if avg else 0},
            {"name": "D-3", "value": _round(avg * 1.01) if avg else 0},
            {"name": "D-2", "value": _round(avg * 0.99) if avg else 0},
            {"name": "D-1", "value": _round(avg * 1.02) if avg else 0},
            {"name": "Atual", "value": _round(avg) if avg else 0},
        ]
        return {
            "distribution": [
                {"name": "Frete grátis", "value": summary["free_shipping_count"]},
                {"name": "Full", "value": summary["full_shipping_count"]},
                {"name": "Novo", "value": summary["new_count"]},
                {"name": "Usado", "value": summary["used_count"]},
            ],
            "price_buckets": buckets,
            "price_trend": trend,
            "seller_sales": seller_columns,
        }

    def _product_from_url(self, parsed):
        token, _ = self._current_access_token()
        if not (self.enabled and self.configured and token):
            return {"source": "mock", "query": parsed["inferred_query"], "title": parsed["slug"], "item_id": parsed["item_id"], "product_id": parsed["product_id"]}
        headers = {"Authorization": "Bearer {0}".format(token)}
        try:
            if parsed.get("item_id"):
                item = safe_fetch_json("https://api.mercadolibre.com/items/{0}".format(parsed["item_id"]), headers=headers, timeout=self.timeout_seconds)
                return {"source": "live", "query": _clean_slug_query(item.get("title") or parsed["inferred_query"]), "title": item.get("title"), "item_id": item.get("id"), "price": item.get("price")}
            if parsed.get("product_id"):
                product = safe_fetch_json("https://api.mercadolibre.com/products/{0}".format(parsed["product_id"]), headers=headers, timeout=self.timeout_seconds)
                return {"source": "live", "query": _clean_slug_query(product.get("name") or parsed["inferred_query"]), "title": product.get("name"), "product_id": product.get("id")}
        except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError):
            return {"source": "mock", "query": parsed["inferred_query"], "title": parsed["slug"], "item_id": parsed["item_id"], "product_id": parsed["product_id"]}
        return {"source": "mock", "query": parsed["inferred_query"], "title": parsed["slug"], "item_id": parsed["item_id"], "product_id": parsed["product_id"]}

    def _mock_results(self, product, query, limit):
        base = float(getattr(product, "price", None) or 26.6 or 100)
        if base <= 0:
            base = 100.0
        sellers = [
            ("Auto Prime Parts", "green_platinum"),
            ("Mega Pecas Brasil", "green"),
            ("Loja Motor Pro", "yellow"),
            ("Center Auto ML", "green"),
            ("Distribuidora Veloz", "green_gold"),
            ("Outlet Autopecas", "orange"),
        ]
        multipliers = [0.82, 0.88, 0.93, 0.97, 1.0, 1.04, 1.09, 1.14, 1.21, 1.28]
        output = []
        for index in range(limit):
            seller, reputation = sellers[index % len(sellers)]
            multiplier = multipliers[index % len(multipliers)] + ((index // len(multipliers)) * 0.015)
            price = round(base * multiplier, 2)
            sold = max(0, int((limit - index) * 7 + (index % 4) * 9))
            title_suffix = ["Original", "Pronta Entrega", "Linha Premium", "Novo Lacrado", "Kit Promocional"][index % 5]
            title_seed = _display_query(query or getattr(product, "name", "Produto"))
            output.append(
                {
                    "external_id": "MOCKMLB{0:06d}".format(index + 1),
                    "title": "{0} {1}".format(title_seed, title_suffix).strip(),
                    "price": price,
                    "permalink": None,
                    "seller": seller,
                    "seller_name": seller,
                    "seller_id": "mock-{0}".format(index % len(sellers)),
                    "seller_reputation": reputation,
                    "condition": "used" if index % 13 == 0 else "new",
                    "listing_type": "gold_pro" if index % 3 == 0 else "gold_special",
                    "free_shipping": index % 2 == 0,
                    "full_shipping": index % 4 == 0,
                    "thumbnail": None,
                    "sold_quantity": sold,
                    "available_quantity": max(1, 80 - index * 2),
                    "category_id": "MLB1747" if index % 2 == 0 else "MLB5672",
                    "catalog_product_id": "MLB-CATALOG-{0}".format(index % 5) if index % 5 == 0 else None,
                    "position": index + 1,
                    "raw": {"mock": True},
                }
            )
        return output
