import { gsap } from "gsap";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ActionButton } from "../components/ActionButton";
import { AlertCard } from "../components/AlertCard";
import { ChartCard, ColumnChart, DonutChart } from "../components/AnalyticsCharts";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { OperationalOrbit } from "../components/OperationalOrbit";
import { PremiumCard } from "../components/PremiumCard";
import { SectionHeader } from "../components/SectionHeader";
import { StatCard } from "../components/StatCard";
import { api } from "../services/api";
import { formatCode, formatMoneyBRL, marginPct, recommendAction, scoreLabel, scoreTone } from "../services/formatters";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function DashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const heroRef = useRef(null);

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
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!heroRef.current || loading || prefersReducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".intro-animate",
        { y: 12 },
        { y: 0, duration: 0.42, stagger: 0.06, ease: "power2.out", clearProps: "transform" }
      );
    }, heroRef);

    return () => ctx.revert();
  }, [loading]);

  const topOpportunities = useMemo(() => {
    return [...products].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 6);
  }, [products]);

  const criticalAlerts = useMemo(() => {
    const noSku = products.filter((p) => !p.sku).slice(0, 4);
    const stalled = products.filter((p) => (p.stock || 0) > 0 && (p.sales_60d || 0) === 0).slice(0, 4);
    const negative = products.filter((p) => (p.stock || 0) < 0).slice(0, 4);
    return { noSku, stalled, negative };
  }, [products]);

  const stats = [
    { title: "Total de produtos", value: dashboard?.total_products || 0, hint: "Base ativa", tone: "accent" },
    { title: "Com estoque", value: dashboard?.products_with_stock || 0, hint: "Prontos para venda", tone: "success" },
    { title: "Vendidos 60d", value: dashboard?.products_sold_60d || 0, hint: "Tração", tone: "accent" },
    { title: "Score alto", value: dashboard?.products_high_score || 0, hint: "Oportunidade", tone: "success" },
    { title: "Reposição urgente", value: dashboard?.products_replenishment_urgent || 0, hint: "Vendas sem estoque", tone: "danger" },
    { title: "Estoque parado", value: dashboard?.stalled_stock_alert || 0, hint: "Atenção", tone: "warning" },
    { title: "Estoque negativo", value: dashboard?.negative_stock_alert || 0, hint: "Crítico", tone: "danger" },
    { title: "Sem estoque geral", value: dashboard?.products_without_stock_general || 0, hint: "Vendidos sem stock", tone: "warning" },
    { title: "Somente estoque", value: dashboard?.products_only_stock || 0, hint: "Sem vendas 60d", tone: "muted" },
    { title: "Sem SKU confiável", value: dashboard?.products_without_sku || 0, hint: "Revisar cadastro", tone: "warning" },
    { title: "Match por SKU", value: dashboard?.match_sku || 0, hint: "Vendidos ∩ Estoque", tone: "success" },
    { title: "Vendidos + Estoque", value: dashboard?.vendidos_plus_estoque || 0, hint: "Origem combinada", tone: "accent" },
  ];

  const statusDistribution = useMemo(() => {
    const labels = {
      announce_first: "Anunciar",
      good_opportunity: "Boa",
      test_carefully: "Teste",
      negative_stock: "Estoque neg.",
      review: "Revisar",
    };
    return Object.entries(
      products.reduce((acc, product) => {
        const key = product.status || "review";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {})
    ).map(([key, value]) => ({ name: labels[key] || key, value }));
  }, [products]);

  const operationMix = useMemo(() => {
    return [
      { name: "Prioridade", value: products.filter((p) => p.status === "announce_first").length },
      { name: "Score alto", value: products.filter((p) => (p.score || 0) >= 70).length },
      { name: "Sem SKU", value: products.filter((p) => !p.sku).length },
      { name: "Estoque neg.", value: products.filter((p) => (p.stock || 0) < 0).length },
      { name: "Parado", value: products.filter((p) => (p.stock || 0) > 0 && (p.sales_60d || 0) === 0).length },
    ];
  }, [products]);

  const orbitMetrics = useMemo(
    () => ({
      totalProducts: dashboard?.total_products || 0,
      sold60d: dashboard?.products_sold_60d || 0,
      highScore: dashboard?.products_high_score || 0,
      missingSku: products.filter((p) => !p.sku).length,
      negativeStock: dashboard?.negative_stock_alert || 0,
      opportunities: products.filter((p) => p.status === "announce_first" || p.status === "good_opportunity").length,
      marketplaces: 4,
    }),
    [dashboard, products]
  );

  const readiness = Math.max(
    0,
    Math.min(100, 100 - (operationMix[2]?.value || 0) - (operationMix[3]?.value || 0) * 3 - Math.round((operationMix[4]?.value || 0) / 10))
  );

  return (
    <div className="page-grid" ref={heroRef}>
      <SectionHeader
        title="Control Room"
        description="Operacao comercial, prioridade de anuncio e risco de catalogo em uma unica visao."
        actions={
          <ActionButton as={Link} to="/importar" variant="primary" icon="+">
            Importar planilha
          </ActionButton>
        }
      />

      <div className="command-strip intro-animate">
        <div>
          <span>Readiness</span>
          <strong>{readiness}%</strong>
          <small>indice interno</small>
        </div>
        <div>
          <span>Fila prioritaria</span>
          <strong>{orbitMetrics.opportunities.toLocaleString("pt-BR")}</strong>
          <small>produtos acionaveis</small>
        </div>
        <div>
          <span>Bloqueios</span>
          <strong>{(orbitMetrics.missingSku + orbitMetrics.negativeStock).toLocaleString("pt-BR")}</strong>
          <small>cadastro + estoque</small>
        </div>
      </div>

      <div className="stats-grid intro-animate">
        {stats.map((stat) => (
          <StatCard key={stat.title} title={stat.title} value={stat.value} hint={stat.hint} tone={stat.tone} />
        ))}
      </div>

      <div className="dashboard-grid intro-animate">
        <ChartCard title="Distribuição por prioridade" caption="Mix atual da base importada">
          <DonutChart data={statusDistribution} />
        </ChartCard>
        <ChartCard title="Mix operacional" caption="Sinais de decisão para marketplace">
          <ColumnChart data={operationMix} />
        </ChartCard>
        <PremiumCard className="health-panel">
          <SectionHeader title="Saude operacional" description="Leitura rapida dos principais bloqueios." />
          <div className="health-score">
            <strong>{readiness.toLocaleString("pt-BR")}</strong>
            <span>Índice interno</span>
          </div>
          <div className="health-lines">
            <div><span>Base ativa</span><strong>{dashboard?.total_products || 0}</strong></div>
            <div><span>Pronto para anúncio</span><strong>{products.filter((p) => p.status === "announce_first").length}</strong></div>
            <div><span>Risco de cadastro</span><strong>{products.filter((p) => !p.sku).length}</strong></div>
          </div>
        </PremiumCard>
      </div>

      <div className="orbit-grid intro-animate">
        <OperationalOrbit metrics={orbitMetrics} />
        <PremiumCard className="recommendation-panel">
          <SectionHeader title="Acoes recomendadas" description="Sequencia pratica para limpar gargalos antes de escalar." />
          <div className="recommendation-list">
            <div>
              <span>01</span>
              <strong>Corrigir divergencias de estoque</strong>
              <p>{orbitMetrics.negativeStock.toLocaleString("pt-BR")} itens negativos bloqueiam publicacao segura.</p>
            </div>
            <div>
              <span>02</span>
              <strong>Normalizar SKU/EAN</strong>
              <p>{orbitMetrics.missingSku.toLocaleString("pt-BR")} registros precisam de codigo confiavel.</p>
            </div>
            <div>
              <span>03</span>
              <strong>Preparar anuncios de score alto</strong>
              <p>{orbitMetrics.highScore.toLocaleString("pt-BR")} itens ja possuem sinal comercial forte.</p>
            </div>
          </div>
        </PremiumCard>
      </div>

      <div className="two-col intro-animate">
        <PremiumCard>
          <SectionHeader title="Top oportunidades" description="Produtos com maior score para preparar anúncio." />
          {topOpportunities.length === 0 ? (
            <EmptyState title="Sem produtos ainda" description="Importe uma planilha para gerar oportunidades automaticamente." />
          ) : (
            <div className="opportunity-list">
              {topOpportunities.map((product) => {
                const m = marginPct(product.cost, product.price);
                return (
                  <Link key={product.id} to={`/produtos/${product.id}`} className="opportunity-row">
                    <div>
                      <h4>{product.name || "Produto sem nome"}</h4>
                      <p>{formatCode(product.sku) !== "-" ? formatCode(product.sku) : formatCode(product.ean)}</p>
                    </div>
                    <div className="opportunity-meta">
                      <Badge tone={scoreTone(product.status)}>{scoreLabel(product)}</Badge>
                      <span>Score {product.score}</span>
                      <span>{m == null ? "Margem n/d" : `${m.toFixed(1)}% margem`}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </PremiumCard>

        <PremiumCard>
          <SectionHeader title="Alertas críticos" description="Itens que exigem ação antes de escalar anúncios." />
          <div className="stack-vertical">
            <AlertCard
              title="Produtos sem SKU"
              description={`${criticalAlerts.noSku.length} itens sem código no recorte atual.`}
              tone="danger"
              badge="Revisar cadastro"
            />
            <AlertCard
              title="Estoque parado"
              description={`${criticalAlerts.stalled.length} itens com estoque e sem vendas 60d.`}
              tone="warning"
              badge="Giro baixo"
            />
            <AlertCard
              title="Estoque negativo"
              description={`${criticalAlerts.negative.length} itens com divergência de estoque.`}
              tone="danger"
              badge="Ajustar inventário"
            />
          </div>
        </PremiumCard>
      </div>

      <PremiumCard className="intro-animate">
        <SectionHeader title="Fila de ação" description="Direcionamentos táticos para os itens mais sensíveis." />
        <div className="action-grid">
          {topOpportunities.slice(0, 4).map((product) => (
            <div key={product.id} className="action-item">
              <h4>{product.name || "Produto sem nome"}</h4>
              <p>{formatMoneyBRL(product.price)} • estoque {product.stock}</p>
              <Badge tone={scoreTone(product.status)}>{recommendAction(product)}</Badge>
            </div>
          ))}
        </div>
      </PremiumCard>
    </div>
  );
}
