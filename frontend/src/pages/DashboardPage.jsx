import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChartCard, ColumnChart } from "../components/AnalyticsCharts";
import { Icon } from "../components/ui/Icon";
import { api } from "../services/api";
import { formatCode, marginPct } from "../services/formatters";

function KpiCard({ icon, label, value, badge, badgeTone = "pos", sub }) {
  return (
    <div className="ms-kpi-card">
      <div className="ms-kpi-head">
        <div className="left">
          <span className="ms-kpi-ico"><Icon name={icon} size={18} /></span>
          {label}
        </div>
      </div>
      <div className="ms-kpi-body">
        <span className="ms-kpi-val">{Number(value || 0).toLocaleString("pt-BR")}</span>
        {badge ? <span className={`ms-badge ms-badge--${badgeTone}`}>{badge}</span> : null}
      </div>
      <span className="ms-kpi-sub">{sub}</span>
    </div>
  );
}

const STATUS_LABELS = {
  announce_first: "Anunciar primeiro",
  good_opportunity: "Boa oportunidade",
  test_carefully: "Testar com cuidado",
  replenishment_urgent: "Reposição urgente",
  stalled_stock: "Estoque parado",
  negative_stock: "Estoque negativo",
  no_stock_general: "Sem estoque geral",
  review: "Revisar",
};

export function DashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [dashRes, prodRes] = await Promise.all([
          api.get("/dashboard"),
          api.get("/products", { params: { limit: 250, offset: 0 } }),
        ]);
        if (!mounted) return;
        setDashboard(dashRes.data);
        setProducts(prodRes.data.items || []);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const topOpportunities = useMemo(
    () => [...products].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 4),
    [products]
  );

  const statusDistribution = useMemo(() => {
    const counts = products.reduce((acc, p) => {
      const key = p.status || "review";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .map(([key, value]) => ({ key, name: STATUS_LABELS[key] || key, value }))
      .sort((a, b) => b.value - a.value);
  }, [products]);

  const totalProducts = dashboard?.total_products || 0;
  const matchSku = dashboard?.match_sku || 0;
  const withoutSku = dashboard?.products_without_sku || 0;
  const fuzzy = Math.max(0, totalProducts - matchSku - withoutSku);
  const pct = (n) => (totalProducts ? Math.round((n / totalProducts) * 100) : 0);

  const alerts = [
    { tone: "danger", icon: "alert", title: "Estoque negativo", desc: "Itens com divergência entre vendido e disponível.", count: dashboard?.negative_stock_alert || 0 },
    { tone: "warn", icon: "sync", title: "Reposição urgente", desc: "SKUs vendidos sem cobertura de estoque suficiente.", count: dashboard?.products_replenishment_urgent || 0 },
    { tone: "info", icon: "alert", title: "Sem SKU confiável", desc: "Itens sem código — revise antes da próxima importação.", count: withoutSku },
    { tone: "warn", icon: "inventory", title: "Estoque parado", desc: "Itens com estoque e sem vendas nos últimos 60 dias.", count: dashboard?.stalled_stock_alert || 0 },
  ];

  if (loading) {
    return (
      <>
        <div className="ms-page-head">
          <div>
            <h1 className="ms-page-title">Visão geral</h1>
            <p className="ms-page-desc">Carregando consolidação da operação…</p>
          </div>
        </div>
        <div className="ms-grid ms-grid-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="ms-skeleton" style={{ height: 124 }} />)}
        </div>
        <div className="insight-row">
          <div className="ms-skeleton" style={{ height: 320 }} />
          <div className="ms-skeleton" style={{ height: 320 }} />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="ms-page-head">
        <div>
          <h1 className="ms-page-title">Visão geral</h1>
          <p className="ms-page-desc">Sua operação consolidada — catálogo, vendas, oportunidades e alertas em um único painel.</p>
        </div>
        <div className="ms-page-actions">
          <Link className="ms-btn ms-btn--secondary" to="/produtos">
            <Icon name="products" size={16} /> Ver produtos
          </Link>
          <Link className="ms-btn ms-btn--primary" to="/importar">
            <Icon name="plus" size={16} /> Importar planilha
          </Link>
        </div>
      </div>

      <div className="ms-grid ms-grid-4">
        <KpiCard icon="products" label="Total de produtos" value={totalProducts}
          badge={`${(dashboard?.products_with_stock || 0).toLocaleString("pt-BR")} c/ estoque`} badgeTone="brand"
          sub={`${(dashboard?.products_with_stock || 0).toLocaleString("pt-BR")} com estoque · ${(dashboard?.products_only_stock || 0).toLocaleString("pt-BR")} só estoque`} />
        <KpiCard icon="arrowUp" label="Vendidos 60d" value={dashboard?.products_sold_60d || 0}
          badge="tração" badgeTone="pos" sub="Produtos com venda no período" />
        <KpiCard icon="opportunities" label="Score alto" value={dashboard?.products_high_score || 0}
          badge="≥ 80" badgeTone="brand" sub="Forte potencial de venda" />
        <KpiCard icon="alert" label="Reposição urgente" value={dashboard?.products_replenishment_urgent || 0}
          badge="crítico" badgeTone="neg" sub="Vendas sem estoque suficiente" />
      </div>

      <div className="insight-row">
        <ChartCard title="Distribuição por prioridade" caption="Mix atual da base importada por status operacional.">
          {statusDistribution.length ? (
            <ColumnChart data={statusDistribution} />
          ) : (
            <div className="ms-empty"><p className="ms-empty-desc">Importe produtos para ver a distribuição.</p></div>
          )}
        </ChartCard>

        <div className="ms-card">
          <div className="ms-row" style={{ justifyContent: "space-between" }}>
            <div className="ms-caps">Match por SKU</div>
            <span className="ms-badge ms-badge--brand">{pct(matchSku)}%</span>
          </div>
          <div className="ms-h2" style={{ marginTop: 8 }}>
            {matchSku.toLocaleString("pt-BR")} / {totalProducts.toLocaleString("pt-BR")}
          </div>
          <p className="ms-small" style={{ margin: "8px 0 0" }}>SKUs reconhecidos com origem confiável entre as bases.</p>

          <div className="ms-stack-sm" style={{ marginTop: 20 }}>
            <div>
              <div className="ms-row" style={{ justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span>Match exato (SKU)</span><span className="ms-num">{matchSku.toLocaleString("pt-BR")}</span>
              </div>
              <div className="ms-progress"><div className="ms-progress-fill" style={{ width: `${pct(matchSku)}%` }} /></div>
            </div>
            <div>
              <div className="ms-row" style={{ justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span>Outras origens</span><span className="ms-num">{fuzzy.toLocaleString("pt-BR")}</span>
              </div>
              <div className="ms-progress"><div className="ms-progress-fill" style={{ width: `${pct(fuzzy)}%`, background: "var(--ms-chart-violet-500)" }} /></div>
            </div>
            <div>
              <div className="ms-row" style={{ justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span>Sem SKU confiável</span><span className="ms-num">{withoutSku.toLocaleString("pt-BR")}</span>
              </div>
              <div className="ms-progress"><div className="ms-progress-fill" style={{ width: `${pct(withoutSku)}%`, background: "var(--ms-warning-fg)" }} /></div>
            </div>
          </div>
        </div>
      </div>

      <div className="secondary-row">
        <div className="ms-card">
          <div className="card-head-row">
            <div>
              <div className="ms-caps">Alertas operacionais</div>
              <div className="ms-h3" style={{ marginTop: 4 }}>Ação recomendada</div>
            </div>
            <Link className="ms-btn ms-btn--ghost ms-btn--sm" to="/oportunidades">Ver todos</Link>
          </div>
          <div className="alert-list">
            {alerts.map((a) => (
              <div key={a.title} className={`alert-item ${a.tone}`}>
                <div className="ico"><Icon name={a.icon} size={18} /></div>
                <div className="body">
                  <div className="title">{a.title}</div>
                  <div className="desc">{a.desc}</div>
                </div>
                <div className="count">{Number(a.count).toLocaleString("pt-BR")}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="ms-card">
          <div className="card-head-row">
            <div>
              <div className="ms-caps">Top oportunidades</div>
              <div className="ms-h3" style={{ marginTop: 4 }}>Maior score</div>
            </div>
            <Link className="ms-btn ms-btn--ghost ms-btn--sm" to="/oportunidades">Abrir</Link>
          </div>
          {topOpportunities.length === 0 ? (
            <p className="ms-empty-desc">Importe uma planilha para gerar oportunidades.</p>
          ) : (
            <div className="opp-mini-list">
              {topOpportunities.map((p) => {
                const m = marginPct(p.cost, p.price);
                const code = formatCode(p.sku) !== "-" ? formatCode(p.sku) : formatCode(p.ean);
                return (
                  <Link key={p.id} to={`/produtos/${p.id}`} className="opp-mini">
                    <div className="thumb">IMG</div>
                    <div className="info">
                      <h4>{p.name || "Produto sem nome"}</h4>
                      <div className="meta">SKU {code} · {m == null ? "margem n/d" : `margem ${m.toFixed(0)}%`}</div>
                    </div>
                    <span className="ms-badge ms-badge--pos">Score {p.score ?? 0}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="ms-card ms-card--flush ms-mt">
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--ms-line)" }}>
          <div className="ms-caps">Distribuição da base</div>
          <div className="ms-h3" style={{ marginTop: 4 }}>Produtos por status operacional</div>
        </div>
        <div className="ms-table-wrap">
          <table className="ms-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: 24 }}>Status</th>
                <th>Produtos</th>
                <th style={{ width: "38%" }}>Share</th>
                <th className="ms-right" style={{ paddingRight: 24 }}>Participação</th>
              </tr>
            </thead>
            <tbody>
              {statusDistribution.map((row) => (
                <tr key={row.key}>
                  <td style={{ paddingLeft: 24, fontWeight: 600, color: "var(--ms-ink)" }}>{row.name}</td>
                  <td className="ms-num">{row.value.toLocaleString("pt-BR")}</td>
                  <td>
                    <div className="ms-progress"><div className="ms-progress-fill" style={{ width: `${pct(row.value)}%` }} /></div>
                  </td>
                  <td className="ms-right ms-num" style={{ paddingRight: 24 }}>{pct(row.value)}%</td>
                </tr>
              ))}
              {statusDistribution.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 32, textAlign: "center", color: "var(--ms-text-2)" }}>Sem dados ainda.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
