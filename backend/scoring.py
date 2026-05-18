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


def priority_from_score(score):
    if score >= 85:
        return "Anunciar primeiro", "announce_first"
    if score >= 70:
        return "Boa oportunidade", "good_opportunity"
    if score >= 50:
        return "Testar com cuidado", "test_carefully"
    return "Revisar", "review"


def calculate_score(name, stock, sales_60d, cost=None, price=None):
    stock = max(int(stock or 0), 0)
    sales_60d = max(int(sales_60d or 0), 0)
    score = 0.0

    sales_component = min((sales_60d / 100) * 45, 45)
    stock_component = min((stock / 80) * 25, 25)

    margin = margin_pct(cost, price)
    margin_component = 0.0
    if margin is not None:
        if margin <= 0:
            margin_component = 0
        elif margin < 15:
            margin_component = 8
        elif margin < 30:
            margin_component = 16
        else:
            margin_component = 25
    else:
        margin_component = 10

    score += sales_component + stock_component + margin_component

    if stock == 0:
        score -= 25

    clean_name = safe_str(name)
    if len(clean_name) < 8:
        score -= 15
    elif len(clean_name.split()) < 2:
        score -= 10

    score = max(0, min(100, round(score, 1)))
    return score
