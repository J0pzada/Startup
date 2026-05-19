def _number(value, default=0.0):
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _round_money(value):
    return round(float(value or 0), 2)


def calculate_profit(
    sale_price,
    purchase_price,
    monthly_sales=1,
    commission_percent=12,
    fixed_fee=0,
    shipping_cost=0,
    tax_percent=4,
    additional_cost=0,
    additional_cost_type="value",
    free_shipping=False,
    listing_type="classico",
    fiscal_regime="simples",
    annual_revenue_bracket="simples_ate_180k",
):
    units = max(_number(monthly_sales, 1), 0)
    sale = max(_number(sale_price), 0)
    purchase = max(_number(purchase_price), 0)
    commission_pct = max(_number(commission_percent, 12), 0)
    tax_pct = max(_number(tax_percent, 4), 0)
    fixed = max(_number(fixed_fee), 0)
    shipping = max(_number(shipping_cost), 0)
    extra = max(_number(additional_cost), 0)

    extra_per_unit = sale * (extra / 100) if additional_cost_type == "percent" else extra
    gross_revenue = sale * units
    product_costs = purchase * units
    commission_total = gross_revenue * (commission_pct / 100)
    fixed_fee_total = fixed * units
    shipping_total = shipping * units if free_shipping else 0
    tax_total = gross_revenue * (tax_pct / 100)
    additional_total = extra_per_unit * units
    net_profit = gross_revenue - product_costs - commission_total - fixed_fee_total - shipping_total - tax_total - additional_total
    profit_per_unit = net_profit / units if units else 0
    net_margin_pct = (net_profit / gross_revenue * 100) if gross_revenue else 0
    margin_per_unit = (profit_per_unit / sale * 100) if sale else 0

    variable_pct = (commission_pct + tax_pct) / 100
    variable_value = purchase + fixed + (shipping if free_shipping else 0) + extra_per_unit

    def min_price_for_margin(target_margin):
        divisor = 1 - variable_pct - (target_margin / 100)
        if divisor <= 0:
            return None
        return _round_money(variable_value / divisor)

    break_even = None
    if sale > 0:
      unit_profit_before_fixed = sale - purchase - (sale * variable_pct) - (shipping if free_shipping else 0) - extra_per_unit
      if unit_profit_before_fixed > 0:
          break_even = _round_money(fixed / unit_profit_before_fixed) if fixed else 1

    return {
        "estimate": True,
        "listing_type": listing_type,
        "fiscal_regime": fiscal_regime,
        "annual_revenue_bracket": annual_revenue_bracket,
        "inputs": {
            "sale_price": sale,
            "purchase_price": purchase,
            "monthly_sales": units,
            "commission_percent": commission_pct,
            "fixed_fee": fixed,
            "shipping_cost": shipping,
            "tax_percent": tax_pct,
            "additional_cost": extra,
            "additional_cost_type": additional_cost_type,
            "free_shipping": bool(free_shipping),
        },
        "receita_bruta": _round_money(gross_revenue),
        "custo_produtos": _round_money(product_costs),
        "comissao_total": _round_money(commission_total),
        "taxa_fixa_total": _round_money(fixed_fee_total),
        "frete_total": _round_money(shipping_total),
        "impostos_total": _round_money(tax_total),
        "custos_adicionais_total": _round_money(additional_total),
        "lucro_liquido": _round_money(net_profit),
        "margem_liquida_percent": round(net_margin_pct, 2),
        "lucro_por_unidade": _round_money(profit_per_unit),
        "margem_por_unidade": round(margin_per_unit, 2),
        "ponto_de_equilibrio": break_even,
        "preco_minimo_para_margem_30": min_price_for_margin(30),
        "preco_minimo_para_margem_40": min_price_for_margin(40),
        "preco_minimo_para_margem_50": min_price_for_margin(50),
        "notes": "Estimativa local. Ajuste comissão, imposto, frete e custos conforme seu regime e operação.",
    }
