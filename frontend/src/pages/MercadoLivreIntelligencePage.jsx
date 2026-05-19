import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChartCard, ColumnChart, DonutChart, TrendLineChart } from "../components/AnalyticsCharts";
import { ActionButton } from "../components/ActionButton";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { PremiumCard } from "../components/PremiumCard";
import { SectionHeader } from "../components/SectionHeader";
import { api } from "../services/api";
import { formatMoneyBRL } from "../services/formatters";

const DEFAULT_LINK_FORM = {
  url: "",
  sale_price: "26.6",
  purchase_price: "9",
  monthly_sales: "342",
  commission_percent: "12",
  tax_percent: "4",
  shipping_cost: "0",
  additional_cost: "0",
};

function numberOrUndefined(value) {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function MetricTile({ label, value, tone = "" }) {
  return (
    <div className={`intel-metric ${tone}`.trim()}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProfitLine({ label, value }) {
  return (
    <div className="profit-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ContextLine({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="context-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CompetitorTable({ items = [] }) {
  if (!items.length) {
    return <EmptyState title="Sem anúncios similares" description="Rode uma análise para preencher a varredura de concorrentes." />;
  }
  return (
    <div className="table-wrap intelligence-table-wrap">
      <table className="premium-table intelligence-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Anúncio</th>
            <th>Preço</th>
            <th>Vendedor</th>
            <th>Vendas</th>
            <th>Frete</th>
            <th>Condição</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.external_id || item.title}-${index}`}>
              <td>{item.position || index + 1}</td>
              <td>
                {item.permalink ? (
                  <a className="table-link" href={item.permalink} target="_blank" rel="noreferrer">
                    {item.title}
                  </a>
                ) : (
                  <span className="table-link">{item.title}</span>
                )}
                <span className="table-subline">{item.similarity_badge || item.seller_reputation || "-"}</span>
              </td>
              <td>{formatMoneyBRL(item.price)}</td>
              <td>{item.seller_name || item.seller || "-"}</td>
              <td>{item.sold_quantity ?? "-"}</td>
              <td>{item.free_shipping ? "Grátis" : "Pago"}</td>
              <td>{item.condition === "new" ? "Novo" : item.condition === "used" ? "Usado" : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SimilarProducts({ items = [] }) {
  if (!items.length) return <EmptyState title="Sem produtos parecidos" description="A análise ainda não encontrou similares." />;
  return (
    <div className="similar-grid">
      {items.slice(0, 8).map((item, index) => (
        <div key={`${item.external_id || item.title}-${index}`} className="similar-card">
          <div>
            <Badge tone={item.similarity_badge === "concorrente direto" ? "success" : "muted"}>
              {item.similarity_badge || "similar amplo"}
            </Badge>
            <Badge tone="accent">{item.similarity_score ?? 0}%</Badge>
          </div>
          <h4>{item.title}</h4>
          <p>{item.seller_name || item.seller || "Vendedor não informado"} • {item.free_shipping ? "frete grátis" : "frete pago"}</p>
          <strong>{formatMoneyBRL(item.price)}</strong>
        </div>
      ))}
    </div>
  );
}

function ProfitCalculatorPanel({ calculation }) {
  if (!calculation) {
    return <EmptyState title="Calculadora aguardando dados" description="Preencha compra, venda e custos para estimar rentabilidade." />;
  }
  return (
    <div className="profit-panel">
      <div className="profit-hero">
        <div>
          <span className="eyebrow">Lucro líquido</span>
          <strong>{formatMoneyBRL(calculation.lucro_liquido)}</strong>
        </div>
        <div>
          <span className="eyebrow">Margem líquida</span>
          <strong>{calculation.margem_liquida_percent}%</strong>
        </div>
      </div>
      <div className="profit-lines">
        <ProfitLine label="Receita bruta" value={formatMoneyBRL(calculation.receita_bruta)} />
        <ProfitLine label="Custo produtos" value={formatMoneyBRL(calculation.custo_produtos)} />
        <ProfitLine label="Comissão" value={formatMoneyBRL(calculation.comissao_total)} />
        <ProfitLine label="Impostos" value={formatMoneyBRL(calculation.impostos_total)} />
        <ProfitLine label="Frete" value={formatMoneyBRL(calculation.frete_total)} />
        <ProfitLine label="Custos adicionais" value={formatMoneyBRL(calculation.custos_adicionais_total)} />
        <ProfitLine label="Lucro por unidade" value={formatMoneyBRL(calculation.lucro_por_unidade)} />
        <ProfitLine label="Preço mínimo margem 40%" value={formatMoneyBRL(calculation.preco_minimo_para_margem_40)} />
      </div>
    </div>
  );
}

export function MercadoLivreIntelligencePage() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(searchParams.get("product_id") ? "product" : "url");
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(searchParams.get("product_id") || "");
  const [linkForm, setLinkForm] = useState(DEFAULT_LINK_FORM);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/products", { params: { limit: 500, offset: 0 } }).then((res) => {
      const list = res.data.items || [];
      setProducts(list);
      if (!selectedProductId && list.length > 0) setSelectedProductId(String(list[0].id));
    });
  }, []);

  async function analyzeProduct() {
    if (!selectedProductId) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.post(`/products/${selectedProductId}/marketplaces/mercadolivre/analyze`, {
        limit: 50,
        force_refresh: true,
      });
      setAnalysis(res.data);
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || "Não foi possível analisar o produto agora.");
    } finally {
      setLoading(false);
    }
  }

  async function analyzeUrl() {
    setLoading(true);
    setError("");
    try {
      const payload = {
        url: linkForm.url,
        sale_price: numberOrUndefined(linkForm.sale_price),
        purchase_price: numberOrUndefined(linkForm.purchase_price),
        monthly_sales: numberOrUndefined(linkForm.monthly_sales),
        commission_percent: numberOrUndefined(linkForm.commission_percent) ?? 12,
        tax_percent: numberOrUndefined(linkForm.tax_percent) ?? 4,
        shipping_cost: numberOrUndefined(linkForm.shipping_cost) ?? 0,
        additional_cost: numberOrUndefined(linkForm.additional_cost) ?? 0,
      };
      const res = await api.post("/marketplaces/mercadolivre/analyze-url", payload);
      setAnalysis(res.data);
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || "Não foi possível analisar o link agora.");
    } finally {
      setLoading(false);
    }
  }

  const market = analysis?.market_summary || {};
  const price = analysis?.price_intelligence || {};
  const sales = analysis?.sales_intelligence || {};
  const competitors = analysis?.competitor_intelligence || {};
  const charts = analysis?.charts || {};
  const profit = analysis?.profit_calculation;
  const context = analysis?.analysis_context || {};
  const modeLabel = context.mode_label || (analysis?.mode === "live" ? "Dados reais Mercado Livre" : "Análise simulada");
  const dynamicRecommendation = useMemo(() => {
    const diff = Number(price.difference_percent || 0);
    if (diff > 8) return "reduzir preço";
    if (diff < -8 && price.internal_margin_percent > 25) return "subir preço";
    if (price.internal_margin_percent != null && price.internal_margin_percent < 18) return "revisar margem";
    return "manter preço";
  }, [price]);

  return (
    <div className="page-grid intelligence-page">
      <SectionHeader
        title="Inteligência Mercado Livre"
        description="Precifique com inteligência, venda com excelência. Monitore a dinâmica de preços, concorrência e rentabilidade para manter vantagem competitiva."
        actions={<Badge tone={analysis?.mode === "live" ? "success" : "muted"}>{modeLabel}</Badge>}
      />

      <PremiumCard className="intelligence-command">
        <div className="segment-control">
          <button type="button" className={mode === "product" ? "is-active" : ""} onClick={() => setMode("product")}>
            Produto interno
          </button>
          <button type="button" className={mode === "url" ? "is-active" : ""} onClick={() => setMode("url")}>
            Link Mercado Livre
          </button>
        </div>

        {mode === "product" ? (
          <div className="intelligence-form">
            <select className="input-premium" value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name || "Produto sem nome"}
                </option>
              ))}
            </select>
            <ActionButton variant="primary" onClick={analyzeProduct} disabled={loading} icon="ML">
              {loading ? "Analisando..." : "Analisar mercado"}
            </ActionButton>
          </div>
        ) : (
          <div className="intelligence-form link-mode">
            <input className="input-premium wide" value={linkForm.url} onChange={(event) => setLinkForm((prev) => ({ ...prev, url: event.target.value }))} placeholder="Cole o link do Mercado Livre" />
            {[
              ["sale_price", "Preço venda"],
              ["purchase_price", "Preço compra"],
              ["monthly_sales", "Vendas/mês"],
              ["commission_percent", "Comissão %"],
              ["tax_percent", "Imposto %"],
              ["shipping_cost", "Frete"],
              ["additional_cost", "Custo adicional"],
            ].map(([key, label]) => (
              <input key={key} className="input-premium" value={linkForm[key]} onChange={(event) => setLinkForm((prev) => ({ ...prev, [key]: event.target.value }))} placeholder={label} />
            ))}
            <ActionButton variant="primary" onClick={analyzeUrl} disabled={loading} icon="ML">
              {loading ? "Analisando..." : "Analisar link"}
            </ActionButton>
          </div>
        )}
        {error ? <div className="inline-alert strong">{error}</div> : null}
      </PremiumCard>

      {analysis ? (
        <>
          <PremiumCard className="analysis-context-panel">
            <div className="source-badges">
              <Badge tone="accent">Origem: {context.origin_label || (mode === "product" ? "Produto interno" : "Link Mercado Livre")}</Badge>
              <Badge tone={analysis.mode === "live" ? "success" : "muted"}>{modeLabel}</Badge>
              <Badge tone="warning">{context.calculator_label || "Calculadora estimada"}</Badge>
            </div>
            <div className="context-grid">
              <ContextLine label="Produto analisado" value={context.product_name || analysis.base_product?.title || analysis.query_used} />
              <ContextLine label="Query usada" value={context.query_used || analysis.query_used} />
              <ContextLine label="URL analisada" value={context.source_url || analysis.source_url} />
              <ContextLine label="ID interno" value={context.internal_product_id} />
              <ContextLine label="WID / item_id" value={context.item_id || analysis.url_parse?.item_id} />
              <ContextLine label="Product/catalog id" value={context.product_id || analysis.url_parse?.product_id} />
            </div>
            <p className="context-note">
              Produto interno usa dados do banco do MapaSeller e a query do cadastro. Link Mercado Livre usa a URL e os dados manuais da calculadora. Em mock, os anúncios são simulados a partir dessa origem.
            </p>
          </PremiumCard>

          <div className="intel-metrics-grid">
            <MetricTile label="Anúncios encontrados" value={market.total_results ?? 0} />
            <MetricTile label="Menor preço" value={formatMoneyBRL(market.min_price)} />
            <MetricTile label="Preço médio" value={formatMoneyBRL(market.avg_price)} />
            <MetricTile label="Preço máximo" value={formatMoneyBRL(market.max_price)} />
            <MetricTile label="Vendedores" value={market.sellers_count ?? 0} />
            <MetricTile label="Receita mock estimada" value={formatMoneyBRL(sales.estimated_monthly_revenue)} />
            <MetricTile label="Margem líquida estimada" value={profit ? `${profit.margem_liquida_percent}%` : "-"} />
            <MetricTile label="Lucro líquido estimado" value={profit ? formatMoneyBRL(profit.lucro_liquido) : "-"} tone={profit?.lucro_liquido < 0 ? "danger" : "success"} />
          </div>

          <div className="dashboard-grid">
            <ChartCard title="Distribuição operacional" caption="Frete, Full e condição dos anúncios analisados.">
              <DonutChart data={charts.distribution || []} />
            </ChartCard>
            <ChartCard title="Preços por faixa" caption="Concentração de ofertas por faixa de preço.">
              <ColumnChart data={charts.price_buckets || []} />
            </ChartCard>
            <ChartCard title="Top vendedores" caption="Vendas estimadas por vendedor no snapshot.">
              <ColumnChart data={charts.seller_sales || []} />
            </ChartCard>
          </div>

          <div className="two-col">
            <PremiumCard>
              <SectionHeader title="Dinâmica de preços" description="Preço médio atual, amplitude e direção recomendada." />
              <div className="price-dynamics">
                <div>
                  <span>Preço médio atual</span>
                  <strong>{formatMoneyBRL(market.avg_price)}</strong>
                </div>
                <div>
                  <span>Variação interna</span>
                  <strong>{price.difference_percent != null ? `${price.difference_percent}%` : "-"}</strong>
                </div>
                <div>
                  <span>Recomendação</span>
                  <strong>{dynamicRecommendation}</strong>
                </div>
              </div>
              <TrendLineChart data={charts.price_trend || []} />
            </PremiumCard>

            <PremiumCard>
              <SectionHeader title="Recomendação de mercado" description="Ação, riscos e próximos passos." />
              <div className="marketplace-recommendation intelligence-recommendation">
                <div>
                  <span className="eyebrow">Ação sugerida</span>
                  <h4>{analysis.recommendation?.action || "-"}</h4>
                  <p>{analysis.recommendation?.short_justification || "-"}</p>
                </div>
                <Badge tone="accent">{sales.competition_level || "concorrência n/d"}</Badge>
              </div>
              <div className="chip-row">
                {(analysis.recommendation?.risks || []).map((risk) => (
                  <Badge key={risk} tone="warning">{risk}</Badge>
                ))}
              </div>
            </PremiumCard>
          </div>

          <PremiumCard>
            <SectionHeader title="Produtos similares" description="Varredura de anúncios parecidos e concorrentes diretos." />
            <SimilarProducts items={analysis.similar_products || competitors.similar_products || []} />
          </PremiumCard>

          <PremiumCard>
            <SectionHeader title="Top anúncios" description="Lista priorizada com preço, vendedor, frete e condição." />
            <CompetitorTable items={analysis.top_ads || competitors.top_ads || []} />
          </PremiumCard>

          <div className="two-col">
            <PremiumCard>
              <SectionHeader title="Calculadora" description="Estimativa editável de comissão, imposto, frete, custos e lucro." />
              <ProfitCalculatorPanel calculation={profit} />
              {profit ? <p className="context-note">Valores estimados a partir de {context.origin === "internal_product" ? "preço, custo e vendas internas do MapaSeller" : "dados manuais informados no formulário"}.</p> : null}
            </PremiumCard>
            <PremiumCard>
              <SectionHeader title="Termos para anúncio" description="Heurística local a partir dos títulos concorrentes." />
              <div className="keyword-cloud">
                {(analysis.listing_quality?.suggested_title_terms || []).map((term) => (
                  <Badge key={term} tone="accent">{term}</Badge>
                ))}
              </div>
              <div className="copy-block">
                <h4>Preço sugerido competitivo</h4>
                <p>{formatMoneyBRL(price.suggested_competitive_price)}</p>
              </div>
              {selectedProductId ? (
                <ActionButton as={Link} to={`/produtos/${selectedProductId}`} variant="outline" icon="P">
                  Voltar ao produto
                </ActionButton>
              ) : null}
            </PremiumCard>
          </div>
        </>
      ) : (
        <EmptyState title="Central pronta para análise" description="Escolha um produto interno ou cole um link do Mercado Livre para iniciar a leitura de mercado." />
      )}
    </div>
  );
}
