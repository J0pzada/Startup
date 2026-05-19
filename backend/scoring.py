def safe_str(value):
    if value is None:
        return ""
    return str(value).strip()


def margin_pct(cost, price):
    if cost is None or price is None:
        return None
    if price <= 0:
        return None
    return ((price - cost) / price) * 100


def classify_alerta(stock, sales_60d, sku_status, match_status):
    """
    Retorna um único alerta dominante a partir do estado do produto.
    Ordem de precedência: estoque negativo > reposição urgente > estoque parado >
    sem estoque geral > SKU ausente > Match fraco > Sem venda recente > None.
    """
    stock_val = int(stock or 0)
    sales = int(sales_60d or 0)

    if stock_val < 0:
        return "Estoque negativo"
    if stock_val <= 0 and sales > 0:
        return "Reposição urgente"
    if match_status == "sem_estoque_geral":
        return "Sem estoque geral"
    if stock_val > 0 and sales == 0:
        if stock_val >= 3:
            return "Estoque parado"
        return "Sem venda recente"
    if sku_status in ("ausente", "codigo_suspeito"):
        return "SKU ausente"
    if match_status == "nome_match_fraco":
        return "Match fraco"
    if sales == 0:
        return "Sem venda recente"
    return None


def classify_estoque_status(stock):
    stock_val = int(stock or 0)
    if stock_val < 0:
        return "Estoque negativo"
    if stock_val == 0:
        return "Sem estoque"
    if stock_val < 3:
        return "Estoque baixo"
    return "Em estoque"


def priority_from_score(score, alerta=None, stock=None, sales_60d=None):
    """
    Calcula prioridade tática a partir do score + alerta dominante.
    Retorna (label_humano, status_slug).
    """
    stock_val = int(stock or 0)
    sales = int(sales_60d or 0)

    if alerta == "Estoque negativo":
        return "Estoque negativo", "negative_stock"
    if alerta == "Reposição urgente":
        return "Reposição urgente", "replenishment_urgent"
    if alerta == "Estoque parado":
        return "Estoque parado", "stalled_stock"
    if alerta == "Sem estoque geral":
        return "Sem estoque geral", "no_stock_general"

    if score >= 85 and stock_val > 0 and sales > 0:
        return "Anunciar primeiro", "announce_first"
    if score >= 70:
        return "Boa oportunidade", "good_opportunity"
    if score >= 50:
        return "Testar com cuidado", "test_carefully"
    return "Revisar", "review"


def calculate_score(
    name,
    stock,
    sales_60d,
    cost=None,
    price=None,
    sku_status=None,
    match_status=None,
    estoque_status=None,
):
    stock_value = int(stock or 0)
    stock_non_negative = max(stock_value, 0)
    sales = max(int(sales_60d or 0), 0)
    score = 0.0

    sales_component = min((sales / 80.0) * 55, 55)
    stock_component = min((stock_non_negative / 60.0) * 20, 20)

    margin = margin_pct(cost, price)
    if margin is None:
        margin_component = 4
    elif margin <= 0:
        margin_component = 0
    elif margin < 15:
        margin_component = 8
    elif margin < 30:
        margin_component = 15
    else:
        margin_component = 20

    score += sales_component + stock_component + margin_component

    # Penalizações de estoque
    if stock_value <= 0 and sales > 0:
        # Reposição urgente: não derruba tudo, mas penaliza
        score -= 10
    elif stock_value <= 0 and sales == 0:
        score -= 25
    if stock_value < 0:
        score -= 8

    # Sem vendas recentes
    if sales == 0 and stock_value > 0:
        # Estoque parado: penaliza
        score -= 18
    elif sales == 0 and stock_value <= 0:
        # Sem venda nem estoque: penalização leve adicional
        score -= 6

    # Custo/preço ausente ou inválido
    if cost is None or price is None:
        score -= 8
    elif price <= 0 or cost < 0:
        score -= 12

    # Nome pobre
    clean_name = safe_str(name)
    if len(clean_name) < 8:
        score -= 12
    elif len(clean_name.split()) < 2:
        score -= 6

    # Penalizações leves por qualidade do match e SKU
    if sku_status in ("ausente", "codigo_suspeito"):
        score -= 4
    if match_status == "nome_match_fraco":
        score -= 3
    if estoque_status == "sem_estoque_geral":
        # Indica revisão, mas não derruba se já tem vendas fortes
        score -= 4

    score = max(0, min(100, round(score, 1)))
    return score
