from marketplace.base import MarketplaceAdapter


class MercadoLivreAdapter(MarketplaceAdapter):
    marketplace_name = "Mercado Livre"

    def get_product_snapshot(self, product):
        return {
            "marketplace": self.marketplace_name,
            "status": "simulado",
            "suggested_price": round((product.price or 0) * 1.03, 2) if product.price else None,
            "estimated_fee_pct": 16,
            "competition_level": "alto",
            "notes": "Mock local: sem consulta externa.",
        }
