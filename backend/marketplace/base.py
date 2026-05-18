from abc import ABC, abstractmethod


class MarketplaceAdapter(ABC):
    marketplace_name = "base"

    @abstractmethod
    def get_product_snapshot(self, product):
        raise NotImplementedError
