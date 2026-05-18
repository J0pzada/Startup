from marketplace.base import MarketplaceAdapter


class AmazonAdapter(MarketplaceAdapter):
    marketplace_name = "Amazon"

    def get_product_snapshot(self, product):
        return {
            "marketplace": self.marketplace_name,
            "status": "simulado",
            "suggested_price": round((product.price or 0) * 1.08, 2) if product.price else None,
            "estimated_fee_pct": 18,
            "competition_level": "alto",
            "notes": "Mock local: sem consulta externa.",
        }
