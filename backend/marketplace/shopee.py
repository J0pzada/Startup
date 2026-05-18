from marketplace.base import MarketplaceAdapter


class ShopeeAdapter(MarketplaceAdapter):
    marketplace_name = "Shopee"

    def get_product_snapshot(self, product):
        return {
            "marketplace": self.marketplace_name,
            "status": "simulado",
            "suggested_price": round((product.price or 0) * 0.98, 2) if product.price else None,
            "estimated_fee_pct": 14,
            "competition_level": "médio",
            "notes": "Mock local: sem consulta externa.",
        }
