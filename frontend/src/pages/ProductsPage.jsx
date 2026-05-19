import { useEffect, useMemo, useState } from "react";
import { ActionButton } from "../components/ActionButton";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { PremiumCard } from "../components/PremiumCard";
import { ProductTable } from "../components/ProductTable";
import { SectionHeader } from "../components/SectionHeader";
import { api } from "../services/api";

function FilterChip({ active, label, onClick }) {
  return (
    <button type="button" className={`filter-chip ${active ? "is-active" : ""}`} onClick={onClick}>
      {label}
    </button>
  );
}

const ALERT_PRESETS = [
  { key: "Reposição urgente", label: "Reposição urgente" },
  { key: "Estoque parado", label: "Estoque parado" },
  { key: "Estoque negativo", label: "Estoque negativo" },
  { key: "Sem estoque geral", label: "Sem estoque geral" },
  { key: "SKU ausente", label: "SKU ausente" },
];

const ORIGIN_PRESETS = [
  { key: "estoque", label: "Somente estoque" },
  { key: "vendidos", label: "Somente vendidos" },
  { key: "vendidos+estoque", label: "Vendidos + Estoque" },
];

export function ProductsPage() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({
    inStock: false,
    sold: false,
    minScore: "",
    status: "",
    alerta: "",
    origem: "",
  });
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = {
        search: query || undefined,
        in_stock: filters.inStock || undefined,
        sold: filters.sold || undefined,
        min_score: filters.minScore || undefined,
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

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    load();
  }, [filters.alerta, filters.origem]);

  const skuMissing = useMemo(
    () => items.filter((p) => !p.sku || p.sku_status === "ausente" || p.sku_status === "codigo_suspeito").length,
    [items]
  );

  return (
    <div className="page-grid">
      <SectionHeader title="Produtos" description="Catalogo operacional com filtros densos, prioridades e sinais de risco." />

      <PremiumCard>
        <div className="filters-layout">
          <label className="label-muted">Busca operacional</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar produto, marca, SKU ou EAN"
            className="input-premium"
          />
          <input
            value={filters.minScore}
            onChange={(e) => setFilters((prev) => ({ ...prev, minScore: e.target.value }))}
            placeholder="Score mínimo"
            className="input-premium"
          />
          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            className="input-premium"
          >
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

          <div className="chip-row">
            <FilterChip active={filters.inStock} label="Com estoque" onClick={() => setFilters((p) => ({ ...p, inStock: !p.inStock }))} />
            <FilterChip active={filters.sold} label="Vendidos 60d" onClick={() => setFilters((p) => ({ ...p, sold: !p.sold }))} />
          </div>

          <div className="chip-row">
            <span className="label-muted">Alerta:</span>
            <FilterChip active={!filters.alerta} label="Todos" onClick={() => setFilters((p) => ({ ...p, alerta: "" }))} />
            {ALERT_PRESETS.map((preset) => (
              <FilterChip
                key={preset.key}
                active={filters.alerta === preset.key}
                label={preset.label}
                onClick={() => setFilters((p) => ({ ...p, alerta: p.alerta === preset.key ? "" : preset.key }))}
              />
            ))}
          </div>

          <div className="chip-row">
            <span className="label-muted">Origem:</span>
            <FilterChip active={!filters.origem} label="Todas" onClick={() => setFilters((p) => ({ ...p, origem: "" }))} />
            {ORIGIN_PRESETS.map((preset) => (
              <FilterChip
                key={preset.key}
                active={filters.origem === preset.key}
                label={preset.label}
                onClick={() => setFilters((p) => ({ ...p, origem: p.origem === preset.key ? "" : preset.key }))}
              />
            ))}
          </div>

          <div className="button-row compact">
            <ActionButton variant="primary" onClick={load} icon="F">
              {loading ? "Atualizando..." : "Aplicar filtros"}
            </ActionButton>
            <Badge tone="muted">SKU ausente: {skuMissing}</Badge>
            <Badge tone="accent">Produtos: {items.length}</Badge>
          </div>
        </div>
      </PremiumCard>

      {items.length === 0 ? <EmptyState title="Nenhum produto encontrado" description="Ajuste os filtros ou importe uma nova planilha." /> : null}

      {items.length > 0 ? (
        <PremiumCard>
          <ProductTable items={items} />
        </PremiumCard>
      ) : null}
    </div>
  );
}
