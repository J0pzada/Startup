import { useEffect, useMemo, useState } from "react";
import { ActionButton } from "../components/ActionButton";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { PremiumCard } from "../components/PremiumCard";
import { SectionHeader } from "../components/SectionHeader";
import { api } from "../services/api";

function CopyBlock({ title, text }) {
  async function copyToClipboard() {
    if (!text) return;
    await navigator.clipboard.writeText(text);
  }

  return (
    <div className="copy-block">
      <div className="copy-head">
        <h4>{title}</h4>
        <ActionButton variant="ghost" size="sm" onClick={copyToClipboard} icon="C">
          Copiar
        </ActionButton>
      </div>
      <p>{text || "-"}</p>
    </div>
  );
}

export function AdCreatorPage() {
  const [products, setProducts] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api.get("/products", { params: { limit: 500 } }).then((res) => {
      const list = res.data.items || [];
      setProducts(list);
      if (list.length > 0) setSelectedId(String(list[0].id));
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    api.get(`/products/${selectedId}`).then((res) => setDetail(res.data));
  }, [selectedId]);

  const longDescription = useMemo(() => {
    if (!detail) return "";
    return `${detail.ad_creator?.base_description || ""}\n\nAplicação: consulte compatibilidade por código da peça, modelo e motorização antes da instalação.`;
  }, [detail]);

  const qaText =
    "Pergunta: É compatível com meu veículo?\nResposta: Confirme o código da peça e aplicação específica antes da compra.\n\nPergunta: Produto é novo?\nResposta: Sim, produto novo conforme descrição do anúncio.";

  if (products.length === 0) {
    return <EmptyState title="Sem produtos disponíveis" description="Importe produtos para gerar conteúdo base de anúncio." />;
  }

  return (
    <div className="page-grid">
      <SectionHeader title="Criador de Anúncios" description="Workspace editorial para preparar anuncios sem depender de integracoes externas." />

      <PremiumCard>
        <div className="filters-layout">
          <label className="label-muted">Selecionar produto</label>
          <select className="input-premium" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name || "Produto sem nome"}
              </option>
            ))}
          </select>
          {detail ? <Badge tone="accent">Score {detail.score}</Badge> : null}
        </div>
      </PremiumCard>

      {detail ? (
        <div className="ad-workspace">
        <PremiumCard>
          <SectionHeader title={detail.name || "Produto"} description="Material editorial pronto para adaptar ao canal de venda." />
          <div className="stack-vertical">
            <CopyBlock title="Título sugerido" text={detail.ad_creator?.suggested_title} />
            <CopyBlock title="Descrição curta" text={detail.ad_creator?.base_description} />
            <CopyBlock title="Descrição completa" text={longDescription} />
            <CopyBlock title="Palavras-chave" text={(detail.ad_creator?.keywords || []).join(", ")} />
            <CopyBlock title="Perguntas e respostas" text={qaText} />
          </div>
          <div className="inline-alert strong">
            Confirme a compatibilidade pelo código da peça antes da compra.
          </div>
        </PremiumCard>
        <PremiumCard className="ad-preview-panel">
          <SectionHeader title="Preview tecnico" description="Bloco compacto para revisar compatibilidade e risco antes de publicar." />
          <div className="ad-preview-card">
            <span>Autopecas / compatibilidade</span>
            <h3>{detail.ad_creator?.suggested_title || detail.name || "Produto"}</h3>
            <p>{detail.ad_creator?.base_description || "Descricao base indisponivel."}</p>
            <div>
              <Badge tone={detail.stock < 0 ? "danger" : "success"}>Estoque {detail.stock ?? 0}</Badge>
              <Badge tone="accent">Score {detail.score}</Badge>
            </div>
          </div>
        </PremiumCard>
        </div>
      ) : null}
    </div>
  );
}
