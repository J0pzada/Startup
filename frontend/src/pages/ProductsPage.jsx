import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";

function tone(status) {
  if (status === "announce_first") return "bg-emerald-100 text-emerald-700";
  if (status === "good_opportunity") return "bg-lime-100 text-lime-700";
  if (status === "test_carefully") return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

export function ProductsPage() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [inStock, setInStock] = useState(false);
  const [sold, setSold] = useState(false);
  const [minScore, setMinScore] = useState("");
  const [status, setStatus] = useState("");

  async function load() {
    const params = {
      search: q || undefined,
      in_stock: inStock || undefined,
      sold: sold || undefined,
      min_score: minScore || undefined,
      status: status || undefined,
    };
    const res = await api.get("/products", { params });
    setItems(res.data.items);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-semibold text-slate-800 mb-6">Produtos</h2>
      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 grid md:grid-cols-5 gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca" className="input" />
        <input value={minScore} onChange={(e) => setMinScore(e.target.value)} placeholder="Score mínimo" className="input" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
          <option value="">Todos status</option>
          <option value="announce_first">Anunciar primeiro</option>
          <option value="good_opportunity">Boa oportunidade</option>
          <option value="test_carefully">Testar com cuidado</option>
          <option value="review">Revisar</option>
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} />Com estoque</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sold} onChange={(e) => setSold(e.target.checked)} />Vendidos 60d</label>
        <button onClick={load} className="px-4 py-2 rounded-md bg-slate-900 text-white md:col-span-5">Aplicar filtros</button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="th">Produto</th><th className="th">Marca</th><th className="th">SKU/EAN</th><th className="th">Estoque</th>
              <th className="th">Custo</th><th className="th">Preço</th><th className="th">Vendas 60d</th><th className="th">Score</th><th className="th">Prioridade</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="td"><Link className="text-sky-700" to={`/produtos/${p.id}`}>{p.name || "-"}</Link></td>
                <td className="td">{p.brand || "-"}</td>
                <td className="td">{p.sku || p.ean || "-"}</td>
                <td className="td">{p.stock}</td>
                <td className="td">{p.cost ?? "-"}</td>
                <td className="td">{p.price ?? "-"}</td>
                <td className="td">{p.sales_60d}</td>
                <td className="td">{p.score}</td>
                <td className="td"><span className={`px-2 py-1 rounded text-xs ${tone(p.status)}`}>{p.priority}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
