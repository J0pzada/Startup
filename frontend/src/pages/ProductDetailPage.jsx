import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
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

export function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [marketplaces, setMarketplaces] = useState([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [productRes, marketRes] = await Promise.all([
        api.get(`/products/${id}`),
        api.get(`/products/${id}/marketplaces`),
      ]);
      if (!mounted) return;
      setProduct(productRes.data);
      setMarketplaces(marketRes.data.items || []);
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
          <SectionHeader title="Marketplaces simulados" description="Snapshot mockado para apoio tático de posicionamento." />
          <div className="market-grid">
            {marketplaces.map((market) => (
              <div key={market.marketplace} className="market-card">
                <h4>{market.marketplace}</h4>
                <p>Preço sugerido: {formatMoneyBRL(market.suggested_price)}</p>
                <p>Taxa estimada: {market.estimated_fee_pct}%</p>
                <p>Concorrência: {market.competition_level}</p>
                <span>{market.notes}</span>
              </div>
            ))}
          </div>
        </PremiumCard>
      </div>
    </div>
  );
}
