import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChartCard, ColumnChart, DonutChart, TrendLineChart } from "../components/AnalyticsCharts";
import { Icon } from "../components/ui/Icon";
import { api, formatApiError } from "../services/api";
import { formatMoneyBRL } from "../services/formatters";

const DEFAULT_LINK_FORM = {
  url: "",
  sale_price: "",
  purchase_price: "",
  monthly_sales: "",
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

function resolveImage(item) {
  if (!item) return null;
  if (item.thumbnail || item.image || item.picture) return item.thumbnail || item.image || item.picture;
  const firstPicture = Array.isArray(item.pictures) ? item.pictures[0] : null;
  return firstPicture?.secure_url || firstPicture?.url || null;
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

function MetricMini({ label, value, tone = "neutral", sub }) {
  return (
    <div className="ms-card" style={{ padding: 18 }}>
      <div className="ms-caps">{label}</div>
      <div className="ms-kpi" style={{ marginTop: 8 }}>{value}</div>
      {sub ? <div className="ms-meta" style={{ marginTop: 6 }}>{sub}</div> : null}
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
  const [mlStatus, setMlStatus] = useState(null);
  const [connectLoading, setConnectLoading] = useState(false);

  useEffect(() => {
    api.get("/products", { params: { limit: 500, offset: 0 } }).then((res) => {
      const list = res.data.items || [];
      setProducts(list);
      if (!selectedProductId && list.length > 0) setSelectedProductId(String(list[0].id));
    }).catch(() => {});
    api.get("/marketplaces/mercadolivre/status").then((res) => setMlStatus(res.data)).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connectMercadoLivre() {
    setConnectLoading(true);
    try {
      const res = await api.get("/mercadolivre/auth/url");
      if (res.data?.configured && res.data?.authorization_url) {
        window.open(res.data.authorization_url, "_blank", "noopener,noreferrer");
      } else {
        setError(res.data?.reason || "Backend não está configurado para OAuth Mercado Livre.");
      }
    } catch (err) {
      setError(formatApiError(err, "Não foi possível iniciar a conexão OAuth."));
    } finally {
      setConnectLoading(false);
    }
  }

  async function analyzeProduct() {
    if (!selectedProductId) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.post(
        `/products/${selectedProductId}/marketplaces/mercadolivre/analyze`,
        { limit: 50, force_refresh: true },
        { timeout: 30_000 },
      );
      setAnalysis(res.data);
    } catch (err) {
      setError(formatApiError(err, err.response ? "Não foi possível analisar o produto agora." : "Erro de rede ou timeout ao analisar produto."));
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
      const res = await api.post("/marketplaces/mercadolivre/analyze-url", payload, { timeout: 30_000 });
      setAnalysis(res.data);
    } catch (err) {
      setError(formatApiError(err, err.response ? "Não foi possível analisar o link agora." : "Erro de rede ou timeout: não foi possível conectar ao servidor."));
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

  const integrationState = (() => {
    if (!mlStatus) return { tone: "neutral", label: "Carregando integração…" };
    if (!mlStatus.configured) return { tone: "neutral", label: "Mock local — backend não configurado para OAuth" };
    if (mlStatus.secret_storage !== "configured") return { tone: "warn", label: "Backend ok, secret storage não configurado" };
    if (!mlStatus.connected) return { tone: "warn", label: "Mercado Livre não conectado" };
    return { tone: "pos", label: "Mercado Livre conectado" };
  })();

  const selectedProduct = products.find((p) => String(p.id) === String(selectedProductId));
  const analyzedProduct = analysis?.base_product || {};
  const analyzedTitle = context.product_name || analyzedProduct.title || selectedProduct?.name || analysis?.query_used || "Produto analisado";
  const analyzedImage = resolveImage(analyzedProduct) || resolveImage(selectedProduct);
  const yourPrice = selectedProduct?.price ?? numberOrUndefined(linkForm.sale_price);
  const similarProducts = analysis?.similar_products || competitors.similar_products || [];
  const topAds = analysis?.top_ads || competitors.top_ads || [];

  return (
    <>
      <div className="ms-page-head">
        <div>
          <h1 className="ms-page-title">Inteligência Mercado Livre</h1>
          <p className="ms-page-desc">Precifique com inteligência, venda com excelência. Monitore preços, concorrência e rentabilidade para manter vantagem competitiva.</p>
        </div>
        <div className="ms-page-actions">
          <span className={`ms-badge ms-badge--${integrationState.tone} ms-badge--dot`}>{integrationState.label}</span>
          {mlStatus?.configured && mlStatus?.secret_storage === "configured" && !mlStatus?.connected ? (
            <button className="ms-btn ms-btn--primary" onClick={connectMercadoLivre} disabled={connectLoading}>
              <Icon name="connect" size={16} /> {connectLoading ? "Abrindo…" : "Conectar Mercado Livre"}
            </button>
          ) : null}
        </div>
      </div>

      {/* Commander */}
      <div className="ml-commander">
        <div className="ml-mode-row">
          <button className={`ms-chip ${mode === "url" ? "ms-chip--active" : ""}`.trim()} onClick={() => setMode("url")}>Analisar link</button>
          <button className={`ms-chip ${mode === "product" ? "ms-chip--active" : ""}`.trim()} onClick={() => setMode("product")}>Produto interno</button>
          <span className={`ms-badge ms-badge--neutral`} style={{ marginLeft: "auto" }}>{modeLabel}</span>
        </div>

        {mode === "url" ? (
          <>
            <div className="ed-row">
              <label className="ms-label">Link do produto Mercado Livre</label>
              <div className="ml-url-row">
                <input className="ms-input" value={linkForm.url} onChange={(e) => setLinkForm((p) => ({ ...p, url: e.target.value }))} placeholder="https://produto.mercadolivre.com.br/MLB-…" />
                <button className="ms-btn ms-btn--primary ms-btn--lg" onClick={analyzeUrl} disabled={loading || !linkForm.url}>
                  <Icon name="bolt" size={16} /> {loading ? "Analisando…" : "Analisar"}
                </button>
              </div>
              <p className="ms-hint">Cole o link completo — funciona com produtos novos, usados e anúncios de catálogo.</p>
            </div>
            <div className="ml-divider">
              <div className="line" /><span className="ms-caps" style={{ fontSize: 10 }}>ou preencha manualmente</span><div className="line" />
            </div>
            <div className="ml-input-grid">
              {[
                ["sale_price", "Preço de venda (R$)"],
                ["purchase_price", "Custo do produto (R$)"],
                ["monthly_sales", "Vendas/mês"],
                ["commission_percent", "Comissão %"],
                ["tax_percent", "Imposto %"],
                ["shipping_cost", "Frete (R$)"],
                ["additional_cost", "Custo adicional (R$)"],
              ].map(([key, label]) => (
                <div key={key} className="ms-field">
                  <label className="ms-label">{label}</label>
                  <input className="ms-input" value={linkForm[key]} onChange={(e) => setLinkForm((p) => ({ ...p, [key]: e.target.value }))} placeholder="—" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="ed-row">
            <label className="ms-label">Produto interno</label>
            <div className="ml-url-row">
              <select className="ms-input" value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}>
                {products.length === 0 ? <option value="">Nenhum produto importado</option> : null}
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name || "Produto sem nome"}</option>
                ))}
              </select>
              <button className="ms-btn ms-btn--primary ms-btn--lg" onClick={analyzeProduct} disabled={loading || !selectedProductId}>
                <Icon name="bolt" size={16} /> {loading ? "Analisando…" : "Analisar mercado"}
              </button>
            </div>
          </div>
        )}

        {error ? (
          <div className="ms-error">
            <Icon name="alert" size={18} />
            <div>
              <p className="ms-error-title">Não foi possível analisar agora</p>
              <p className="ms-error-msg">{error}</p>
            </div>
          </div>
        ) : null}
      </div>

      {loading && !analysis ? (
        <div className="ms-card ms-mt ms-stack-sm">
          <div className="ms-skeleton" style={{ height: 18, width: "60%" }} />
          <div className="ms-skeleton" style={{ height: 14, width: "40%" }} />
          <div className="ms-grid ms-grid-4" style={{ marginTop: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="ms-skeleton" style={{ height: 90 }} />)}
          </div>
        </div>
      ) : null}

      {analysis ? (
        <>
          {/* Analyzed product */}
          <div className="product-card ms-mt">
            <div className="img">{analyzedImage ? <img src={analyzedImage} alt={analyzedTitle} /> : "IMG"}</div>
            <div>
              <div className="ms-row">
                <span className="ms-app-ico ms-app-ico--ml ms-app-ico--sm">ML</span>
                <span className="ms-caps">{context.item_id || context.product_id || "Produto analisado"}</span>
                <span className={`ms-badge ms-badge--${analysis.mode === "live" ? "pos" : "neutral"}`} style={{ marginLeft: "auto" }}>
                  {modeLabel}
                </span>
              </div>
              <h2 className="product-title" style={{ marginTop: 10 }}>{analyzedTitle}</h2>
              <div className="ms-row" style={{ marginTop: 8 }}>
                <span className="ms-meta">SKU {selectedProduct?.sku || "—"}</span>
                <span className="ms-meta">· {market.total_results ?? 0} anúncios encontrados</span>
              </div>
              <div className="price-grid">
                <div className="price-cell"><div className="lab">Preço mínimo</div><div className="val">{formatMoneyBRL(market.min_price)}</div><div className="sub">menor oferta</div></div>
                <div className="price-cell"><div className="lab">Preço médio</div><div className="val">{formatMoneyBRL(market.avg_price)}</div><div className="sub">{market.sellers_count ?? 0} vendedores</div></div>
                <div className="price-cell is-you"><div className="lab">Seu preço</div><div className="val">{formatMoneyBRL(yourPrice)}</div><div className="sub">{price.difference_percent != null ? `${price.difference_percent}% vs média` : "—"}</div></div>
              </div>
            </div>
          </div>

          {/* Recommendation alert */}
          <div className={`ms-alert ms-alert--info ms-mt`} style={{ padding: "18px 20px" }}>
            <Icon name="bolt" size={18} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: "var(--ms-info-fg)", fontSize: 15 }}>Recomendação de mercado</div>
              <p style={{ margin: "6px 0 0", color: "var(--ms-text)", lineHeight: 1.55 }}>
                {analysis.recommendation?.short_justification || `Sugestão dinâmica: ${dynamicRecommendation}.`}
                {price.suggested_competitive_price ? (
                  <> Preço sugerido competitivo: <strong>{formatMoneyBRL(price.suggested_competitive_price)}</strong>.</>
                ) : null}
              </p>
              {analysis.recommendation?.risks?.length ? (
                <div className="ms-row" style={{ marginTop: 10 }}>
                  {analysis.recommendation.risks.map((r) => <span key={r} className="ms-badge ms-badge--warn">{r}</span>)}
                </div>
              ) : null}
            </div>
          </div>

          {/* Metric mini grid */}
          <div className="metric-grid ms-mt">
            <MetricMini label="Anúncios" value={(market.total_results ?? 0).toLocaleString("pt-BR")} sub="snapshot" />
            <MetricMini label="Vendedores" value={(market.sellers_count ?? 0).toLocaleString("pt-BR")} sub="ativos no recorte" />
            <MetricMini label="Receita estimada/mês" value={formatMoneyBRL(sales.estimated_monthly_revenue)} sub={analysis.mode === "live" ? "live" : "mock"} />
            <MetricMini label="Margem líquida" value={profit ? `${profit.margem_liquida_percent}%` : "—"} sub={profit?.lucro_liquido < 0 ? "risco" : "saudável"} />
          </div>

          {/* Charts row */}
          <div className="ms-grid ms-grid-3 ms-mt">
            <ChartCard title="Distribuição operacional" caption="Frete, Full e condição dos anúncios analisados.">
              <DonutChart data={charts.distribution || []} />
            </ChartCard>
            <ChartCard title="Preços por faixa" caption="Concentração de ofertas por faixa de preço.">
              <ColumnChart data={charts.price_buckets || []} />
            </ChartCard>
            <ChartCard title="Top vendedores" caption="Vendas estimadas por vendedor.">
              <ColumnChart data={charts.seller_sales || []} />
            </ChartCard>
          </div>

          {/* Price dynamics + recommendation */}
          <div className="analysis-grid ms-mt">
            <div className="ms-stack">
              <div className="ms-card">
                <div className="ms-caps">Dinâmica de preços</div>
                <div className="price-dynamics">
                  <div><span>Preço médio</span><strong>{formatMoneyBRL(market.avg_price)}</strong></div>
                  <div><span>Variação interna</span><strong>{price.difference_percent != null ? `${price.difference_percent}%` : "—"}</strong></div>
                  <div><span>Recomendação</span><strong>{dynamicRecommendation}</strong></div>
                </div>
                <TrendLineChart data={charts.price_trend || []} />
              </div>

              <div className="ms-card ms-card--flush">
                <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--ms-line)" }}>
                  <div className="ms-caps">Top anúncios</div>
                  <div className="ms-h3" style={{ marginTop: 4 }}>Quem está vendendo o mesmo produto</div>
                </div>
                <div className="ms-table-wrap">
                  {topAds.length === 0 ? (
                    <div className="ms-empty" style={{ padding: 32 }}>
                      <p className="ms-empty-desc">Sem anúncios no snapshot. Rode uma análise para preencher.</p>
                    </div>
                  ) : (
                    <table className="ms-table">
                      <thead>
                        <tr>
                          <th style={{ paddingLeft: 24 }}>#</th>
                          <th>Anúncio</th>
                          <th>Vendedor</th>
                          <th className="ms-right">Preço</th>
                          <th className="ms-right">Vendas</th>
                          <th className="ms-right" style={{ paddingRight: 24 }}>Frete</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topAds.slice(0, 10).map((item, idx) => (
                          <tr key={`${item.external_id || item.title}-${idx}`}>
                            <td style={{ paddingLeft: 24 }} className="ms-num">{item.position || idx + 1}</td>
                            <td>
                              {item.permalink ? (
                                <a className="ms-table-link" href={item.permalink} target="_blank" rel="noreferrer">{item.title}</a>
                              ) : <span className="ms-table-link">{item.title}</span>}
                              <span className="ms-cell-sub">{item.similarity_badge || item.seller_reputation || "—"}</span>
                            </td>
                            <td>{item.seller_name || item.seller || "—"}</td>
                            <td className="ms-right ms-num">{formatMoneyBRL(item.price)}</td>
                            <td className="ms-right ms-num">{item.sold_quantity ?? "—"}</td>
                            <td className="ms-right" style={{ paddingRight: 24 }}>
                              <span className={`ms-badge ms-badge--${item.free_shipping ? "pos" : "neutral"}`}>{item.free_shipping ? "Grátis" : "Pago"}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            <div className="ms-stack">
              {/* Calculator */}
              <div className="calc">
                <div className="ms-caps">Calculadora de margem</div>
                <p className="ms-small" style={{ margin: "6px 0 18px" }}>Estimativa com base nos parâmetros enviados.</p>
                {profit ? (
                  <>
                    <div className="calc-row"><span className="lab">Receita bruta</span><span className="val">{formatMoneyBRL(profit.receita_bruta)}</span></div>
                    <div className="calc-row is-neg"><span className="lab">Custo produtos</span><span className="val">− {formatMoneyBRL(profit.custo_produtos)}</span></div>
                    <div className="calc-row is-neg"><span className="lab">Comissão</span><span className="val">− {formatMoneyBRL(profit.comissao_total)}</span></div>
                    <div className="calc-row is-neg"><span className="lab">Impostos</span><span className="val">− {formatMoneyBRL(profit.impostos_total)}</span></div>
                    <div className="calc-row is-neg"><span className="lab">Frete</span><span className="val">− {formatMoneyBRL(profit.frete_total)}</span></div>
                    <div className="calc-row is-neg"><span className="lab">Custos adicionais</span><span className="val">− {formatMoneyBRL(profit.custos_adicionais_total)}</span></div>
                    <div className="calc-row is-total"><span className="lab">Lucro líquido</span><span className="val">{formatMoneyBRL(profit.lucro_liquido)}</span></div>
                    <div className="ms-row" style={{ justifyContent: "space-between", marginTop: 8 }}>
                      <span className="ms-meta">Margem líquida</span>
                      <span className={`ms-badge ms-badge--${profit.margem_liquida_percent >= 18 ? "pos" : "warn"}`}>{profit.margem_liquida_percent}%</span>
                    </div>
                  </>
                ) : (
                  <p className="ms-small">Preencha preço, custo e parâmetros para estimar lucro.</p>
                )}
              </div>

              {/* Context */}
              <div className="ms-card">
                <div className="ms-caps">Origem dos dados</div>
                <div className="context-grid">
                  <ContextLine label="Origem" value={context.origin_label || (mode === "product" ? "Produto interno" : "Link Mercado Livre")} />
                  <ContextLine label="Query" value={context.query_used || analysis.query_used} />
                  <ContextLine label="URL" value={context.source_url || analysis.source_url} />
                  <ContextLine label="ID interno" value={context.internal_product_id} />
                  <ContextLine label="WID / item_id" value={context.item_id || analysis.url_parse?.item_id} />
                  <ContextLine label="Catalog id" value={context.product_id || analysis.url_parse?.product_id} />
                </div>
                <p className="context-note">
                  Produto interno usa dados do MapaSeller. Link Mercado Livre usa a URL e a calculadora manual. Em mock, anúncios são simulados a partir dessa origem.
                </p>
              </div>

              {/* Suggested terms */}
              {analysis.listing_quality?.suggested_title_terms?.length ? (
                <div className="ms-card">
                  <div className="ms-caps">Termos para anúncio</div>
                  <div className="keyword-cloud" style={{ marginTop: 12 }}>
                    {analysis.listing_quality.suggested_title_terms.map((t) => (
                      <span key={t} className="ms-badge ms-badge--brand">{t}</span>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedProductId ? (
                <Link className="ms-btn ms-btn--secondary" to={`/produtos/${selectedProductId}`}>
                  <Icon name="products" size={16} /> Voltar ao produto interno
                </Link>
              ) : null}
            </div>
          </div>

          {/* Similar */}
          <div className="ms-card ms-mt">
            <div className="card-head-row">
              <div>
                <div className="ms-caps">Produtos similares</div>
                <div className="ms-h3" style={{ marginTop: 4 }}>Mesma categoria, alternativas relevantes</div>
              </div>
              <span className="ms-meta">{similarProducts.length} encontrados</span>
            </div>
            {similarProducts.length === 0 ? (
              <p className="ms-empty-desc">A análise ainda não encontrou similares.</p>
            ) : (
              <div className="similar-grid">
                {similarProducts.slice(0, 8).map((item, idx) => {
                  const img = resolveImage(item);
                  return (
                    <a key={`${item.external_id || item.title}-${idx}`} className="similar-card" href={item.permalink || "#"} target={item.permalink ? "_blank" : "_self"} rel="noreferrer">
                      <div className="img">{img ? <img src={img} alt={item.title} /> : "IMG"}</div>
                      <div className="name">{item.title}</div>
                      <div className="price">{formatMoneyBRL(item.price)}</div>
                      <div className="seller">{(item.seller_name || item.seller || "Vendedor")} · {item.sold_quantity ?? 0} vendas</div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : !loading ? (
        <div className="ms-card ms-mt">
          <div className="ms-empty">
            <div className="ms-empty-ico"><Icon name="mercadolivre" size={26} /></div>
            <h3 className="ms-empty-title">Central pronta para análise</h3>
            <p className="ms-empty-desc">Escolha um produto interno ou cole um link do Mercado Livre para iniciar a leitura de mercado.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
