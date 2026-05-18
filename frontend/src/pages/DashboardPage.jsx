import { useEffect, useState } from "react";
import { api } from "../services/api";

const cardTone = ["bg-emerald-50", "bg-sky-50", "bg-amber-50", "bg-lime-50", "bg-rose-50"];

export function DashboardPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/dashboard").then((res) => setData(res.data));
  }, []);

  const cards = [
    { title: "Total de produtos", value: data?.total_products ?? "-" },
    { title: "Produtos com estoque", value: data?.products_with_stock ?? "-" },
    { title: "Vendidos nos últimos 60 dias", value: data?.products_sold_60d ?? "-" },
    { title: "Produtos com score alto", value: data?.products_high_score ?? "-" },
    { title: "Alerta estoque parado", value: data?.stalled_stock_alert ?? "-" },
  ];

  return (
    <div>
      <h2 className="text-2xl font-semibold text-slate-800 mb-6">Dashboard</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card, idx) => (
          <div key={card.title} className={`rounded-lg p-5 border border-slate-200 ${cardTone[idx]}`}>
            <p className="text-sm text-slate-600">{card.title}</p>
            <p className="text-3xl font-bold text-slate-800 mt-2">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
