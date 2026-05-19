from abc import ABC, abstractmethod


class MarketplaceAdapter(ABC):
    marketplace_name = "base"

    @abstractmethod
    def get_product_snapshot(self, product):
        raise NotImplementedError

    def get_status(self):
        return {
            "enabled": False,
            "configured": False,
            "mode": "mock",
        }
