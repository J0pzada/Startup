import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ActionButton } from "../components/ActionButton";
import { ChartCard, Sparkline } from "../components/AnalyticsCharts";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { PremiumCard } from "../components/PremiumCard";
import { SectionHeader } from "../components/SectionHeader";
import { api } from "../services/api";
import { formatCode, formatMoneyBRL, scoreLabel, scoreTone } from "../services/formatters";

function DecisionLine({ label, value }) {
  return (
    <div className="decision-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ScoreRing({ value = 0 }) {
  const score = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="score-ring" style={{ "--score": `${score * 3.6}deg` }}>
      <div>
        <span>Score</span>
        <strong>{score}</strong>
      </div>
    </div>
  );
}

function MarketplaceMetric({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [mercadoLivre, setMercadoLivre] = useState(null);
  const [mlStatus, setMlStatus] = useState(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlError, setMlError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [productRes, marketRes, statusRes] = await Promise.all([
        api.get(`/products/${id}`),
        api.get(`/products/${id}/marketplaces`),
        api.get("/marketplaces/mercadolivre/status"),
      ]);
      if (!mounted) return;
      setProduct(productRes.data);
      setMercadoLivre(marketRes.data.mercadolivre || null);
      setMlStatus(statusRes.data);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  const alertText = useMemo(() => {
    if (!product) return "";
    if (product.alerta === "Estoque negativo") return "Estoque negativo: revisar inventário antes de anunciar.";
    if (product.alerta === "Reposição urgente") return "Reposição urgente: há vendas, mas estoque zerado/negativo.";
    if (product.alerta === "Estoque parado") return "Estoque parado: há produto, mas sem vendas em 60 dias.";
    if (product.alerta === "Sem estoque geral") return "Sem estoque geral: produto vendido sem cobertura no inventário.";
    if (product.alerta === "SKU ausente") return "SKU ausente: revise cadastro para evitar erros de publicação.";
    if (product.alerta === "Match fraco") return "Match fraco entre planilhas: revisar consolidação.";
    if (product.alerta === "Sem venda recente") return "Sem vendas recentes: valide demanda e concorrência.";
    return "Dados consistentes para priorizar estratégia de anúncio.";
  }, [product]);

  const productProfile = useMemo(() => {
    if (!product) return [];
    return [
      { name: "Estoque", value: Math.max(0, Number(product.stock || 0)) },
      { name: "Vendas", value: Number(product.sales_60d || 0) },
      { name: "Score", value: Number(product.score || 0) },
      { name: "Margem", value: Number(product.margin_pct || 0) },
    ];
  }, [product]);

  const mlAnalysis = mercadoLivre?.latest_snapshot?.summary || null;
  const mlMode = mlAnalysis?.source || mlStatus?.mode || mercadoLivre?.status || "mock";
  const mlMarket = mlAnalysis?.market_summary || mlAnalysis || {};
  const mlPrice = mlAnalysis?.price_intelligence || {};
  const mlRecommendation = mlAnalysis?.recommendation?.action || mlAnalysis?.recommendation || mlAnalysis?.recommendation_label;
  const mlContext = mlAnalysis?.analysis_context || {};

  async function analyzeMercadoLivre() {
    setMlLoading(true);
    setMlError("");
    try {
      const res = await api.post(`/products/${id}/marketplaces/mercadolivre/analyze`, { limit: 50, force_refresh: true });
      setMercadoLivre((prev) => ({
        ...(prev || {}),
        status: res.data.source || prev?.status || "mock",
        latest_snapshot: {
          id: res.data.snapshot_id,
          product_id: Number(id),
          marketplace: "mercadolivre",
          query: res.data.query_used,
          total_results: res.data.total_results,
          min_price: res.data.min_price,
          avg_price: res.data.avg_price,
          max_price: res.data.max_price,
          sellers_count: res.data.sellers_count,
          created_at: res.data.snapshot_created_at,
          summary: res.data,
        },
      }));
      if (res.data.error) setMlError(res.data.error);
    } catch (error) {
      setMlError(error?.response?.data?.detail || "Não foi possível analisar o Mercado Livre agora.");
    } finally {
      setMlLoading(false);
    }
  }

  if (!product) return <EmptyState title="Carregando produto" description="Buscando dados detalhados para decisão comercial." />;

  return (
    <div className="page-grid">
      <SectionHeader
        title={product.name || "Produto"}
        description="Central de decisão para publicação, preço e risco operacional."
        actions={<Badge tone={scoreTone(product.status)}>{scoreLabel(product)}</Badge>}
      />

      <div className="two-col">
        <PremiumCard>
          <div className="detail-command">
            <ScoreRing value={product.score} />
            <div>
              <span className="eyebrow">Diagnostico operacional</span>
              <h3>{product.recommendation || "Revisar estrategia"}</h3>
              <p>{alertText}</p>
            </div>
          </div>

          <div className="kpi-grid compact">
            <div><span>Estoque</span><strong>{product.stock ?? 0}</strong></div>
            <div><span>Vendas 60d</span><strong>{product.sales_60d ?? 0}</strong></div>
            <div><span>Margem</span><strong>{product.margin_pct != null ? `${product.margin_pct}%` : "n/d"}</strong></div>
          </div>

          <div className="decision-grid">
            <DecisionLine label="SKU" value={formatCode(product.sku)} />
            <DecisionLine label="EAN" value={formatCode(product.ean)} />
            <DecisionLine label="Estoque" value={product.stock ?? 0} />
            <DecisionLine label="Vendas 60d" value={product.sales_60d ?? 0} />
            <DecisionLine label="Custo" value={formatMoneyBRL(product.cost)} />
            <DecisionLine label="Preço" value={formatMoneyBRL(product.price)} />
            <DecisionLine label="Margem" value={product.margin_pct != null ? `${product.margin_pct}%` : "n/d"} />
            <DecisionLine label="Valor total estoque" value={formatMoneyBRL(product.valor_total_estoque)} />
            <DecisionLine label="Origem" value={product.origem_importacao || "-"} />
            <DecisionLine label="Match" value={product.match_status || "-"} />
            <DecisionLine label="Status SKU" value={product.sku_status || "-"} />
            <DecisionLine label="Alerta" value={product.alerta || "-"} />
            <DecisionLine label="Recomendação" value={product.recommendation || "Revisar"} />
          </div>

          <div className="next-steps">
            <h4>Proximos passos</h4>
            <ol>
              <li>Validar codigo da peca e aplicacao por veiculo.</li>
              <li>Ajustar estoque antes de publicar se houver divergencia.</li>
              <li>Usar o criador de anuncios para preparar titulo e descricao.</li>
            </ol>
          </div>
        </PremiumCard>

        <ChartCard title="Perfil do produto" caption="Estoque, vendas, score e margem em uma leitura visual.">
          <Sparkline data={productProfile} />
        </ChartCard>
      </div>

      <div className="two-col">
        <PremiumCard>
          <SectionHeader title="Preparação de anúncio" description="Texto base e palavras-chave para acelerar publicação." />
          <div className="copy-block">
            <h4>Título sugerido</h4>
            <p>{product.ad_creator?.suggested_title || "-"}</p>
          </div>
          <div className="copy-block">
            <h4>Descrição base</h4>
            <p>{product.ad_creator?.base_description || "-"}</p>
          </div>
          <div className="copy-block">
            <h4>Palavras-chave</h4>
            <p>{(product.ad_creator?.keywords || []).join(", ") || "-"}</p>
          </div>
        </PremiumCard>

        <PremiumCard>
          <SectionHeader
            title="Inteligência Mercado Livre"
            description="Análise manual de concorrência, faixa de preço e recomendação comercial."
            actions={
              <div className="section-actions">
                <Badge tone={mlMode === "live" ? "success" : "muted"}>{mlMode === "live" ? "live" : "mock"}</Badge>
                <ActionButton variant="primary" size="sm" onClick={analyzeMercadoLivre} disabled={mlLoading} icon="ML">
                  {mlLoading ? "Analisando..." : "Analisar Mercado Livre"}
                </ActionButton>
                <ActionButton as={Link} to={`/marketplaces/mercadolivre?product_id=${id}`} variant="outline" size="sm" icon=">">
                  Ver análise completa
                </ActionButton>
              </div>
            }
          />

          <div className="ml-status-row">
            <Badge tone={mlStatus?.enabled ? "success" : "muted"}>
              {mlStatus?.enabled ? "Dados reais Mercado Livre" : "Análise simulada"}
            </Badge>
            <span>Query prevista: {mercadoLivre?.query_preview || "-"}</span>
          </div>

          {mlError ? <div className="inline-alert strong">{mlError}</div> : null}

          {mlAnalysis ? (
            <div className="stack-vertical">
              <div className="kpi-grid marketplace-kpis">
                <MarketplaceMetric label="Anúncios" value={mlMarket.total_results ?? 0} />
                <MarketplaceMetric label="Menor preço" value={formatMoneyBRL(mlMarket.min_price)} />
                <MarketplaceMetric label="Preço médio" value={formatMoneyBRL(mlMarket.avg_price)} />
                <MarketplaceMetric label="Maior preço" value={formatMoneyBRL(mlMarket.max_price)} />
                <MarketplaceMetric label="Diferença vs média" value={formatMoneyBRL(mlPrice.difference_value ?? mlAnalysis.difference_vs_avg)} />
              </div>

              <div className="marketplace-recommendation">
                <div>
                  <span className="eyebrow">Recomendação automática</span>
                  <h4>{mlRecommendation || "revisar cadastro"}</h4>
                  <p>
                    Origem: {mlContext.origin_label || "Produto interno"} • Query usada: {mlAnalysis.query_used || "-"} • vendedores: {mlMarket.sellers_count ?? 0}
                  </p>
                </div>
                <Badge tone={mlAnalysis.source === "live" ? "success" : "muted"}>
                  {mlAnalysis.source === "live" ? "Dados reais Mercado Livre" : "Dados mock Mercado Livre"}
                </Badge>
              </div>

              <div className="table-wrap marketplace-table-wrap">
                <table className="premium-table marketplace-table">
                  <thead>
                    <tr>
                      <th>Anúncio</th>
                      <th>Preço</th>
                      <th>Vendedor</th>
                      <th>Condição</th>
                      <th>Frete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(mlAnalysis.top_ads || []).map((ad, index) => (
                      <tr key={`${ad.title}-${index}`}>
                        <td>
                          {ad.link ? (
                            <a href={ad.link} target="_blank" rel="noreferrer" className="table-link">
                              {ad.title || "Anúncio sem título"}
                            </a>
                          ) : (
                            <span className="table-link">{ad.title || "Anúncio sem título"}</span>
                          )}
                        </td>
                        <td>{formatMoneyBRL(ad.price)}</td>
                        <td>{ad.seller_name || ad.seller || "-"}</td>
                        <td>{ad.condition === "new" ? "Novo" : ad.condition === "used" ? "Usado" : "-"}</td>
                        <td>{ad.free_shipping === true ? "Grátis" : ad.free_shipping === false ? "Pago" : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState title="Mercado Livre ainda não analisado" description="Clique para gerar o primeiro snapshot deste produto." />
          )}
        </PremiumCard>
      </div>
    </div>
  );
}
