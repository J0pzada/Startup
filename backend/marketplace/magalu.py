from marketplace.base import MarketplaceAdapter


class MagaluAdapter(MarketplaceAdapter):
    marketplace_name = "Magalu"

    def get_product_snapshot(self, product):
        return {
            "marketplace": self.marketplace_name,
            "status": "simulado",
            "suggested_price": round((product.price or 0) * 1.01, 2) if product.price else None,
            "estimated_fee_pct": 13,
            "competition_level": "médio",
            "notes": "Mock local: sem consulta externa.",
        }
