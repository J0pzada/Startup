import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { PremiumCard } from "../components/PremiumCard";
import { SectionHeader } from "../components/SectionHeader";
import { api } from "../services/api";
import { alertaTone, formatCode, formatMoneyBRL, marginPct, recommendAction, scoreLabel, scoreTone } from "../services/formatters";

function OpportunityGroup({ title, items, accent = "accent" }) {
  if (items.length === 0) return null;

  return (
    <PremiumCard className="deal-flow-panel">
      <SectionHeader title={title} description={`${items.length} itens neste grupo.`} />
      <div className="opportunity-list">
        {items.map((product) => {
          const margin = marginPct(product.cost, product.price);
          return (
            <Link key={product.id} to={`/produtos/${product.id}`} className="opportunity-row deal-row">
              <div>
                <h4>{product.name || "Produto sem nome"}</h4>
                <p>SKU: {formatCode(product.sku)} • Estoque: {product.stock ?? 0} • Vendas 60d: {product.sales_60d ?? 0}</p>
              </div>
              <div className="opportunity-meta">
                <span>{formatMoneyBRL(product.price)}</span>
                <span>{margin == null ? "Margem n/d" : `${margin.toFixed(1)}%`}</span>
                <Badge tone={scoreTone(product.status)}>{scoreLabel(product)}</Badge>
                {product.alerta ? <Badge tone={alertaTone(product.alerta)}>{product.alerta}</Badge> : null}
                <Badge tone={accent}>{recommendAction(product)}</Badge>
              </div>
            </Link>
          );
        })}
      </div>
    </PremiumCard>
  );
}

export function OpportunitiesPage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.get("/products", { params: { limit: 500, offset: 0 } }).then((res) => setItems(res.data.items || []));
  }, []);

  const groups = useMemo(() => {
    const announceFirst = items.filter((p) => p.status === "announce_first");
    const good = items.filter((p) => p.status === "good_opportunity");
    const replenishment = items.filter((p) => p.alerta === "Reposição urgente");
    const stalled = items.filter((p) => p.alerta === "Estoque parado");
    const noStockGeneral = items.filter((p) => p.alerta === "Sem estoque geral");
    const reviewSku = items.filter(
      (p) => !p.sku || p.sku_status === "ausente" || p.sku_status === "codigo_suspeito"
    );

    return { announceFirst, good, replenishment, stalled, noStockGeneral, reviewSku };
  }, [items]);

  const hasItems = items.length > 0;

  return (
    <div className="page-grid">
      <SectionHeader
        title="Oportunidades"
        description="Painel de decisao para acelerar anuncios e reduzir risco de catalogo."
      />

      {!hasItems ? <EmptyState title="Sem dados para análise" description="Importe produtos para habilitar a trilha de oportunidades." /> : null}

      {hasItems ? (
        <>
          <div className="kpi-grid opportunity-summary">
            <div><span>Anunciar primeiro</span><strong>{groups.announceFirst.length}</strong></div>
            <div><span>Boa oportunidade</span><strong>{groups.good.length}</strong></div>
            <div><span>Reposicao urgente</span><strong>{groups.replenishment.length}</strong></div>
            <div><span>Estoque parado</span><strong>{groups.stalled.length}</strong></div>
            <div><span>Revisar cadastro</span><strong>{groups.reviewSku.length}</strong></div>
          </div>
          <OpportunityGroup title="Anunciar primeiro" items={groups.announceFirst.slice(0, 20)} accent="success" />
          <OpportunityGroup title="Boa oportunidade" items={groups.good.slice(0, 20)} accent="accent" />
          <OpportunityGroup title="Reposição urgente" items={groups.replenishment.slice(0, 20)} accent="danger" />
          <OpportunityGroup title="Estoque parado" items={groups.stalled.slice(0, 20)} accent="warning" />
          <OpportunityGroup title="Sem estoque geral" items={groups.noStockGeneral.slice(0, 20)} accent="warning" />
          <OpportunityGroup title="Revisar cadastro / SKU" items={groups.reviewSku.slice(0, 20)} accent="muted" />
        </>
      ) : null}
    </div>
  );
}
