import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../services/api";

export function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [marketplaces, setMarketplaces] = useState([]);

  useEffect(() => {
    api.get(`/products/${id}`).then((res) => setProduct(res.data));
    api.get(`/products/${id}/marketplaces`).then((res) => setMarketplaces(res.data.items));
  }, [id]);

  if (!product) return <p>Carregando...</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-slate-800">{product.name || "Produto"}</h2>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
          <p><strong>Marca:</strong> {product.brand || "-"}</p>
          <p><strong>SKU:</strong> {product.sku || "-"}</p>
          <p><strong>EAN:</strong> {product.ean || "-"}</p>
          <p><strong>Preço atual:</strong> {product.price ?? "-"}</p>
          <p><strong>Margem estimada:</strong> {product.margin_pct != null ? `${product.margin_pct}%` : "-"}</p>
          <p><strong>Score:</strong> {product.score}</p>
          <p><strong>Recomendação:</strong> {product.recommendation}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="font-semibold mb-2">Criador de anúncio</h3>
          <p className="text-sm"><strong>Título sugerido:</strong> {product.ad_creator.suggested_title}</p>
          <p className="text-sm mt-2"><strong>Descrição base:</strong> {product.ad_creator.base_description}</p>
          <p className="text-sm mt-2"><strong>Palavras-chave:</strong> {product.ad_creator.keywords.join(", ") || "-"}</p>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h3 className="font-semibold mb-3">Marketplaces (simulado)</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {marketplaces.map((m) => (
            <div key={m.marketplace} className="border border-slate-200 rounded-lg p-3">
              <p className="font-medium">{m.marketplace}</p>
              <p className="text-sm text-slate-600">Preço sugerido: {m.suggested_price ?? "-"}</p>
              <p className="text-sm text-slate-600">Taxa estimada: {m.estimated_fee_pct}%</p>
              <p className="text-sm text-slate-600">Concorrência: {m.competition_level}</p>
              <p className="text-xs text-slate-500 mt-1">{m.notes}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
