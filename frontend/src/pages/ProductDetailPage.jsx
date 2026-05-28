import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Icon } from "../components/ui/Icon";
import { api, formatApiError } from "../services/api";
import { alertaTone, formatCode, formatMoneyBRL, scoreLabel, scoreTone } from "../services/formatters";

const TONE_TO_BADGE = { success: "pos", accent: "brand", warning: "warn", danger: "neg", muted: "neutral" };
const badgeClass = (tone) => `ms-badge ms-badge--${TONE_TO_BADGE[tone] || "neutral"}`;

function Decision({ label, value }) {
  return (
    <div className="context-line">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

function ringStroke(score) {
  if (score >= 80) return "var(--ms-positive-fg)";
  if (score >= 55) return "var(--ms-brand-600)";
  return "var(--ms-warning-fg)";
}

function ScoreRing({ value = 0 }) {
  const score = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="opp-score-ring" style={{ width: 84, height: 84 }}>
      <svg viewBox="0 0 42 42" style={{ transform: "rotate(-90deg)", width: "100%", height: "100%" }}>
        <circle cx="21" cy="21" r="18" fill="none" stroke="var(--ms-surface-2)" strokeWidth="4" />
        <circle cx="21" cy="21" r="18" fill="none" stroke={ringStroke(score)} strokeWidth="4" strokeDasharray={`${score} 100`} pathLength="100" strokeLinecap="round" />
      </svg>
      <div className="opp-score-num" style={{ fontSize: 20 }}>{score}</div>
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
      try {
        const [productRes, marketRes, statusRes] = await Promise.all([
          api.get(`/products/${id}`),
          api.get(`/products/${id}/marketplaces`),
          api.get("/marketplaces/mercadolivre/status"),
        ]);
        if (!mounted) return;
        setProduct(productRes.data);
        setMercadoLivre(marketRes.data.mercadolivre || null);
        setMlStatus(statusRes.data);
      } catch (err) {
        if (mounted) setMlError(formatApiError(err, "Falha ao carregar produto."));
      }
    }
    load();
    return () => { mounted = false; };
  }, [id]);

  async function analyzeMercadoLivre() {
    setMlLoading(true);
    setMlError("");
    try {
      const res = await api.post(`/products/${id}/marketplaces/mercadolivre/analyze`, { limit: 50, force_refresh: true });
      setMercadoLivre((prev) => ({
        ...(prev || {}),
        status: res.data.source || prev?.status || "mock",
        latest_snapshot: { summary: res.data },
      }));
      if (res.data.error) setMlError(res.data.error);
    } catch (err) {
      setMlError(formatApiError(err, "Não foi possível analisar o Mercado Livre agora."));
    } finally {
      setMlLoading(false);
    }
  }

  const alertText = useMemo(() => {
    if (!product) return "";
    if (product.alerta === "Estoque negativo") return "Estoque negativo: revisar inventário antes de anunciar.";
    if (product.alerta === "Reposição urgente") return "Reposição urgente: há vendas, mas estoque zerado ou negativo.";
    if (product.alerta === "Estoque parado") return "Estoque parado: há produto, mas sem vendas em 60 dias.";
    if (product.alerta === "Sem estoque geral") return "Sem estoque geral: produto vendido sem cobertura no inventário.";
    if (product.alerta === "SKU ausente") return "SKU ausente: revise cadastro para evitar erros de publicação.";
    return "Dados consistentes para priorizar estratégia de anúncio.";
  }, [product]);

  if (!product) {
    return (
      <div className="ms-card">
        <div className="ms-empty">
          <div className="ms-empty-ico"><Icon name="products" size={26} /></div>
          <h3 className="ms-empty-title">Carregando produto</h3>
          <p className="ms-empty-desc">Buscando dados detalhados para decisão comercial.</p>
        </div>
      </div>
    );
  }

  const mlAnalysis = mercadoLivre?.latest_snapshot?.summary || null;
  const mlMarket = mlAnalysis?.market_summary || mlAnalysis || {};
  const mlRecommendation = mlAnalysis?.recommendation?.action || mlAnalysis?.recommendation_label;
  const mlMode = mlAnalysis?.source || mlStatus?.mode || mercadoLivre?.status || "mock";

  return (
    <>
      <div className="ms-page-head">
        <div>
          <h1 className="ms-page-title">{product.name || "Produto"}</h1>
          <p className="ms-page-desc">Central de decisão para publicação, preço e risco operacional.</p>
        </div>
        <div className="ms-page-actions">
          <span className={badgeClass(scoreTone(product.status))}>{scoreLabel(product)}</span>
          {product.alerta ? <span className={badgeClass(alertaTone(product.alerta))}>{product.alerta}</span> : null}
          <Link className="ms-btn ms-btn--secondary" to="/produtos"><Icon name="products" size={16} /> Voltar</Link>
        </div>
      </div>

      <div className="analysis-grid">
        <div className="ms-card">
          <div className="ms-row" style={{ gap: 16, alignItems: "center" }}>
            <ScoreRing value={product.score} />
            <div>
              <div className="ms-caps">Diagnóstico operacional</div>
              <div className="ms-h3" style={{ marginTop: 4 }}>{product.recommendation || "Revisar estratégia"}</div>
              <p className="ms-small" style={{ margin: "6px 0 0" }}>{alertText}</p>
            </div>
          </div>

          <div className="summary-row ms-mt">
            <div className="summary-cell"><div className="lab">Estoque</div><div className="val">{product.stock ?? 0}</div></div>
            <div className="summary-cell"><div className="lab">Vendas 60d</div><div className="val">{product.sales_60d ?? 0}</div></div>
            <div className="summary-cell"><div className="lab">Margem</div><div className="val">{product.margin_pct != null ? `${product.margin_pct}%` : "n/d"}</div></div>
            <div className="summary-cell"><div className="lab">Valor estoque</div><div className="val" style={{ fontSize: 16 }}>{formatMoneyBRL(product.valor_total_estoque)}</div></div>
          </div>

          <div className="context-grid ms-mt">
            <Decision label="SKU" value={formatCode(product.sku)} />
            <Decision label="EAN" value={formatCode(product.ean)} />
            <Decision label="Custo" value={formatMoneyBRL(product.cost)} />
            <Decision label="Preço" value={formatMoneyBRL(product.price)} />
            <Decision label="Origem" value={product.origem_importacao} />
            <Decision label="Match" value={product.match_status} />
            <Decision label="Status SKU" value={product.sku_status} />
            <Decision label="Recomendação" value={product.recommendation} />
          </div>
        </div>

        <div className="ms-stack">
          <div className="ms-card">
            <div className="ms-caps">Próximos passos</div>
            <ol style={{ margin: "12px 0 0", paddingLeft: 18, color: "var(--ms-text)", lineHeight: 1.7, fontSize: 13 }}>
              <li>Validar código da peça e aplicação por veículo.</li>
              <li>Ajustar estoque antes de publicar se houver divergência.</li>
              <li>Usar a Central de Anúncios para preparar título e descrição.</li>
            </ol>
          </div>

          <div className="ms-card">
            <div className="ms-caps">Preparação de anúncio</div>
            <div className="ms-stack-sm" style={{ marginTop: 12 }}>
              <div className="copy-block">
                <div className="copy-head"><h4>Título sugerido</h4></div>
                <p>{product.ad_creator?.suggested_title || "—"}</p>
              </div>
              <div className="copy-block">
                <div className="copy-head"><h4>Descrição base</h4></div>
                <p>{product.ad_creator?.base_description || "—"}</p>
              </div>
              <div className="copy-block">
                <div className="copy-head"><h4>Palavras-chave</h4></div>
                <p>{(product.ad_creator?.keywords || []).join(", ") || "—"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="ms-card ms-mt">
        <div className="card-head-row">
          <div>
            <div className="ms-caps">Inteligência Mercado Livre</div>
            <div className="ms-h3" style={{ marginTop: 4 }}>Análise de concorrência e preço</div>
          </div>
          <div className="ms-row">
            <span className={`ms-badge ms-badge--${mlMode === "live" ? "pos" : "neutral"}`}>{mlMode === "live" ? "live" : "mock"}</span>
            <button className="ms-btn ms-btn--primary ms-btn--sm" onClick={analyzeMercadoLivre} disabled={mlLoading}>
              <Icon name="bolt" size={14} /> {mlLoading ? "Analisando…" : "Analisar Mercado Livre"}
            </button>
            <Link to={`/marketplaces/mercadolivre?product_id=${id}`} className="ms-btn ms-btn--secondary ms-btn--sm">
              <Icon name="mercadolivre" size={14} /> Ver análise completa
            </Link>
          </div>
        </div>

        {mlError ? (
          <div className="ms-error" style={{ marginBottom: 12 }}>
            <Icon name="alert" size={18} />
            <div><p className="ms-error-title">Falha</p><p className="ms-error-msg">{mlError}</p></div>
          </div>
        ) : null}

        {mlAnalysis ? (
          <>
            <div className="metric-grid">
              <div className="ms-card" style={{ padding: 16 }}><div className="ms-caps">Anúncios</div><div className="ms-kpi" style={{ marginTop: 6 }}>{(mlMarket.total_results ?? 0).toLocaleString("pt-BR")}</div></div>
              <div className="ms-card" style={{ padding: 16 }}><div className="ms-caps">Menor preço</div><div className="ms-kpi" style={{ marginTop: 6 }}>{formatMoneyBRL(mlMarket.min_price)}</div></div>
              <div className="ms-card" style={{ padding: 16 }}><div className="ms-caps">Preço médio</div><div className="ms-kpi" style={{ marginTop: 6 }}>{formatMoneyBRL(mlMarket.avg_price)}</div></div>
              <div className="ms-card" style={{ padding: 16 }}><div className="ms-caps">Vendedores</div><div className="ms-kpi" style={{ marginTop: 6 }}>{mlMarket.sellers_count ?? 0}</div></div>
            </div>

            <div className="ms-alert ms-alert--info ms-mt">
              <Icon name="bolt" size={18} />
              <div>
                <strong>Recomendação:</strong> {mlRecommendation || "revisar cadastro"}.
                {mlAnalysis.query_used ? <> Query usada: <em>{mlAnalysis.query_used}</em>.</> : null}
              </div>
            </div>
          </>
        ) : (
          <div className="ms-empty">
            <div className="ms-empty-ico"><Icon name="mercadolivre" size={26} /></div>
            <h3 className="ms-empty-title">Mercado Livre ainda não analisado</h3>
            <p className="ms-empty-desc">Gere o primeiro snapshot deste produto para visualizar preços e concorrência.</p>
          </div>
        )}
      </div>
    </>
  );
}
