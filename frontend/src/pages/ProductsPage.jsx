import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/ui/Icon";
import { api } from "../services/api";
import { alertaTone, formatCode, formatMoneyBRL, scoreLabel, scoreTone } from "../services/formatters";

const TONE_TO_BADGE = { success: "pos", accent: "brand", warning: "warn", danger: "neg", muted: "neutral" };
const badgeClass = (tone) => `ms-badge ms-badge--${TONE_TO_BADGE[tone] || "neutral"}`;

const QUICK_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "inStock", label: "Com estoque" },
  { key: "sold", label: "Vendidos 60d" },
  { key: "highScore", label: "Score alto" },
];

const ALERT_PRESETS = ["Reposição urgente", "Estoque parado", "Estoque negativo", "Sem estoque geral", "SKU ausente"];
const ORIGIN_PRESETS = [
  { key: "estoque", label: "Somente estoque" },
  { key: "vendidos", label: "Somente vendidos" },
  { key: "vendidos+estoque", label: "Vendidos + Estoque" },
];

function originLabel(origem) {
  if (!origem) return "—";
  if (origem === "vendidos+estoque") return "Vendidos + Estoque";
  if (origem === "vendidos") return "Vendidos";
  if (origem === "estoque") return "Somente estoque";
  return origem;
}

function scoreColor(score) {
  if (score >= 80) return "var(--ms-positive-fg)";
  if (score >= 55) return "var(--ms-brand-600)";
  return "var(--ms-warning-fg)";
}

export function ProductsPage() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ inStock: false, sold: false, highScore: false, status: "", alerta: "", origem: "" });
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = {
        search: query || undefined,
        in_stock: filters.inStock || undefined,
        sold: filters.sold || undefined,
        min_score: filters.highScore ? 80 : undefined,
        status: filters.status || undefined,
        alerta: filters.alerta || undefined,
        origem: filters.origem || undefined,
        limit: 300,
      };
      const res = await api.get("/products", { params });
      setItems(res.data.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // auto-apply on filter chip/select changes
  useEffect(() => { load(); }, [filters.alerta, filters.origem, filters.inStock, filters.sold, filters.highScore, filters.status]);

  // debounced search — fires 400ms after user stops typing
  useEffect(() => {
    const t = setTimeout(() => load(), 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const skuMissing = useMemo(
    () => items.filter((p) => !p.sku || p.sku_status === "ausente" || p.sku_status === "codigo_suspeito").length,
    [items]
  );

  function toggleQuick(key) {
    if (key === "all") { setFilters((p) => ({ ...p, inStock: false, sold: false, highScore: false })); return; }
    setFilters((p) => ({ ...p, [key]: !p[key] }));
  }
  const allActive = !filters.inStock && !filters.sold && !filters.highScore;

  return (
    <>
      <div className="ms-page-head">
        <div>
          <h1 className="ms-page-title">Produtos</h1>
          <p className="ms-page-desc">Catálogo operacional com busca, filtros, prioridades e sinais de risco por SKU.</p>
        </div>
        <div className="ms-page-actions">
          <Link className="ms-btn ms-btn--primary" to="/importar"><Icon name="plus" size={16} /> Importar planilha</Link>
        </div>
      </div>

      <div className="ms-card ms-card--flush">
        <div className="toolbar">
          <div className="ms-search">
            <Icon name="search" size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, marca, SKU ou EAN…"
            />
          </div>
          <div className="group">
            {QUICK_FILTERS.map((f) => (
              <button
                key={f.key}
                className={`ms-chip ${f.key === "all" ? (allActive ? "ms-chip--active" : "") : (filters[f.key] ? "ms-chip--active" : "")}`.trim()}
                onClick={() => toggleQuick(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="group" style={{ marginLeft: "auto" }}>
            <select className="ms-input" style={{ width: "auto" }} value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
              <option value="">Todos os status</option>
              <option value="announce_first">Anunciar primeiro</option>
              <option value="good_opportunity">Boa oportunidade</option>
              <option value="test_carefully">Testar com cuidado</option>
              <option value="replenishment_urgent">Reposição urgente</option>
              <option value="stalled_stock">Estoque parado</option>
              <option value="negative_stock">Estoque negativo</option>
              <option value="no_stock_general">Sem estoque geral</option>
              <option value="review">Revisar</option>
            </select>
            {loading ? <span className="ms-meta" style={{ whiteSpace: "nowrap" }}>Atualizando…</span> : null}
          </div>
        </div>

        <div className="toolbar" style={{ borderTop: 0, paddingTop: 0 }}>
          <div className="group">
            <span className="ms-meta" style={{ marginRight: 4 }}>Alerta:</span>
            <button className={`ms-chip ${!filters.alerta ? "ms-chip--active" : ""}`.trim()} onClick={() => setFilters((p) => ({ ...p, alerta: "" }))}>Todos</button>
            {ALERT_PRESETS.map((a) => (
              <button key={a} className={`ms-chip ${filters.alerta === a ? "ms-chip--active" : ""}`.trim()} onClick={() => setFilters((p) => ({ ...p, alerta: p.alerta === a ? "" : a }))}>{a}</button>
            ))}
          </div>
          <div className="group" style={{ marginLeft: "auto" }}>
            <span className="ms-meta" style={{ marginRight: 4 }}>Origem:</span>
            <button className={`ms-chip ${!filters.origem ? "ms-chip--active" : ""}`.trim()} onClick={() => setFilters((p) => ({ ...p, origem: "" }))}>Todas</button>
            {ORIGIN_PRESETS.map((o) => (
              <button key={o.key} className={`ms-chip ${filters.origem === o.key ? "ms-chip--active" : ""}`.trim()} onClick={() => setFilters((p) => ({ ...p, origem: p.origem === o.key ? "" : o.key }))}>{o.label}</button>
            ))}
          </div>
        </div>

        <div className="meta-row">
          <div><strong>{items.length.toLocaleString("pt-BR")}</strong> produtos · ordenado por Score</div>
          <div className="ms-row">
            <span className="ms-badge ms-badge--neutral">SKU ausente: {skuMissing}</span>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="ms-empty">
            <div className="ms-empty-ico"><Icon name="products" size={26} /></div>
            <h3 className="ms-empty-title">Nenhum produto encontrado</h3>
            <p className="ms-empty-desc">Ajuste os filtros ou importe uma nova planilha de vendidos e estoque.</p>
            <Link className="ms-btn ms-btn--primary" to="/importar"><Icon name="upload" size={16} /> Importar planilha</Link>
          </div>
        ) : (
          <div className="ms-table-wrap">
            <table className="ms-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24 }}>Produto</th>
                  <th>SKU</th>
                  <th className="ms-right">Estoque</th>
                  <th className="ms-right">Vendas 60d</th>
                  <th className="ms-right">Preço</th>
                  <th className="ms-right">Custo</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th style={{ paddingRight: 24 }}>Origem</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const code = formatCode(p.sku) !== "-" ? formatCode(p.sku) : formatCode(p.ean);
                  const isNegative = (p.stock || 0) < 0;
                  const noSku = !p.sku || p.sku_status === "ausente" || p.sku_status === "codigo_suspeito";
                  const score = p.score ?? 0;
                  return (
                    <tr key={p.id} className={isNegative ? "is-danger" : ""}>
                      <td style={{ paddingLeft: 24 }}>
                        <div className="prod-cell">
                          <div className="prod-thumb">IMG</div>
                          <div>
                            <Link to={`/produtos/${p.id}`} className="ms-table-link prod-name">{p.name || "Produto sem nome"}</Link>
                            <div className="prod-cat">{p.brand || p.categoria || "Sem categoria"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="ms-num">
                        {code}
                        {noSku ? <span className="ms-cell-sub danger">SKU ausente</span> : null}
                      </td>
                      <td className={`ms-right ms-num ${isNegative ? "ms-neg" : ""}`}>{p.stock ?? 0}</td>
                      <td className="ms-right ms-num">{p.sales_60d ?? 0}</td>
                      <td className="ms-right ms-num">{formatMoneyBRL(p.price)}</td>
                      <td className="ms-right ms-num">{formatMoneyBRL(p.cost)}</td>
                      <td>
                        <div className="score-cell">
                          <span className="score-bar"><span style={{ width: `${Math.min(100, score)}%`, background: scoreColor(score) }} /></span>
                          <span className="ms-num">{score}</span>
                        </div>
                      </td>
                      <td>
                        <span className={badgeClass(scoreTone(p.status))}>{scoreLabel(p)}</span>
                        {p.alerta ? <span className={`${badgeClass(alertaTone(p.alerta))}`} style={{ marginLeft: 6 }}>{p.alerta}</span> : null}
                      </td>
                      <td style={{ paddingRight: 24 }} className="ms-meta">{originLabel(p.origem_importacao)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
