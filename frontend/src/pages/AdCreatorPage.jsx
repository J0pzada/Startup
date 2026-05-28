import { useEffect, useMemo, useState } from "react";
import { Icon } from "../components/ui/Icon";
import { api, formatApiError } from "../services/api";
import { formatMoneyBRL } from "../services/formatters";

function CopyBlock({ title, text }) {
  async function copy() {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  }
  return (
    <div className="copy-block">
      <div className="copy-head">
        <h4>{title}</h4>
        <button className="ms-btn ms-btn--ghost ms-btn--sm" onClick={copy}><Icon name="file" size={14} /> Copiar</button>
      </div>
      <p>{text || "—"}</p>
    </div>
  );
}

function ChecklistItem({ state, label, desc }) {
  return (
    <div className={`check-item ${state}`}>
      <div className="mark">
        {state === "ok" ? <Icon name="check" size={12} /> : state === "warn" ? "!" : null}
      </div>
      <div className="body">
        <div className="label">{label}</div>
        <div className="desc">{desc}</div>
      </div>
    </div>
  );
}

const QUICK_ACTIONS = [
  { label: "Criar anúncio", icon: "plus", desc: "Novo anúncio a partir de um SKU existente.", message: "Rascunho visual preparado. Nenhuma publicação real executada." },
  { label: "Otimizar título", icon: "wand", desc: "IA sugere variações com termos de busca.", message: "Título reprocessado no modo visual." },
  { label: "Gerar descrição", icon: "file", desc: "Descrição estruturada com bullets.", message: "Descrição gerada visualmente para revisão." },
  { label: "Sincronizar preço", icon: "price", desc: "Aplica preço do ERP nos anúncios.", message: "Sincronização de preço simulada." },
  { label: "Sincronizar estoque", icon: "inventory", desc: "Empurra estoque atualizado para o ML.", message: "Sincronização de estoque simulada." },
  { label: "Perguntas & respostas", icon: "chat", desc: "Bloco priorizado para revisão manual.", message: "Perguntas pendentes abertas para revisão." },
];

export function AdCreatorPage() {
  const [products, setProducts] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [mlStatus, setMlStatus] = useState(null);
  const [auditMessage, setAuditMessage] = useState("Nenhuma ação operacional executada nesta sessão.");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/products", { params: { limit: 500 } })
      .then((res) => {
        const list = res.data.items || [];
        setProducts(list);
        if (list.length > 0) setSelectedId(String(list[0].id));
      })
      .catch((err) => setError(formatApiError(err, "Falha ao carregar produtos para anúncios.")));
    api.get("/marketplaces/mercadolivre/status").then((res) => setMlStatus(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    api.get(`/products/${selectedId}`)
      .then((res) => setDetail(res.data))
      .catch((err) => setError(formatApiError(err, "Falha ao carregar o produto selecionado.")));
  }, [selectedId]);

  const mlInsights = detail?.ad_creator?.ml_insights;
  const suggestedTitle = detail?.ad_creator?.suggested_title || (detail?.name ? `${detail.name} — Mercado Livre` : "");
  const baseDescription = detail?.ad_creator?.base_description || "Descrição operacional pronta para revisão, com atributos, compatibilidade e política comercial organizados para publicação assistida.";
  const suggestedKeywords = mlInsights?.suggested_keywords?.length ? mlInsights.suggested_keywords : (detail?.ad_creator?.keywords || []);
  const mlTitle = useMemo(() => {
    const terms = mlInsights?.suggested_title_terms || [];
    if (!terms.length) return suggestedTitle;
    return `${detail?.name || "Produto"} ${terms.slice(0, 4).join(" ")}`;
  }, [detail, mlInsights, suggestedTitle]);
  const mlStrategy = mlInsights?.has_analysis
    ? `Estratégia: ${mlInsights.strategy || "validar margem antes"}. ${mlInsights.suggested_price ? `Preço inicial competitivo ${formatMoneyBRL(mlInsights.suggested_price)}.` : ""}`
    : "Sem análise ML recente. Rode a Inteligência ML para enriquecer título, preço e estratégia.";

  const stock = Number(detail?.stock ?? 0);
  const connectionTone = mlStatus?.connected ? "pos" : mlStatus?.configured ? "warn" : "neutral";
  const connectionLabel = mlStatus?.connected ? "Conta conectada" : mlStatus?.configured ? "OAuth pendente" : "Modo local / mock";

  const checklist = [
    { state: mlTitle ? "ok" : "miss", label: "Título técnico", desc: "Termos principais aplicados." },
    { state: baseDescription ? "ok" : "miss", label: "Descrição base", desc: "Texto pronto para adaptação manual." },
    { state: mlInsights?.has_analysis ? "ok" : "warn", label: "Inteligência ML", desc: "Análise recente melhora preço e palavras-chave." },
    { state: stock > 0 ? "ok" : "warn", label: "Estoque disponível", desc: stock > 0 ? "Pronto para publicação." : "Repor antes de publicar." },
  ];

  const priorities = [
    { t: "Responder perguntas pendentes", m: "Atendimento · reduz atrito no anúncio", badge: "neg", tag: "01" },
    { t: "Validar estoque antes de publicar", m: "Operação · evita venda sem disponibilidade", badge: "warn", tag: "02" },
    { t: "Sincronizar preço competitivo", m: "Margem · depende da Inteligência ML", badge: "brand", tag: "03" },
    { t: "Revisar atributos obrigatórios", m: "Catálogo · 3 atributos pendentes", badge: "neutral", tag: "04" },
  ];

  return (
    <>
      <div className="ms-page-head">
        <div>
          <h1 className="ms-page-title">Central de Anúncios</h1>
          <p className="ms-page-desc">Workspace operacional para revisar conteúdo, conexão, preview e checklist antes de qualquer publicação real no Mercado Livre.</p>
        </div>
      </div>

      {error ? (
        <div className="ms-error">
          <Icon name="alert" size={18} />
          <div><p className="ms-error-title">Erro</p><p className="ms-error-msg">{error}</p></div>
        </div>
      ) : null}

      {/* Connection bar */}
      <div className="conn-bar">
        <div className="logo">ML</div>
        <div className="conn-info">
          <div className="ms-row">
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ms-ink)" }}>Mercado Livre · FM Auto Peças</span>
            <span className={`ms-badge ms-badge--${connectionTone} ms-badge--dot`}>{connectionLabel}</span>
            {mlStatus?.nickname ? <span className="ms-badge ms-badge--brand">{mlStatus.nickname}</span> : null}
            {mlStatus?.fallback_to_mock ? <span className="ms-badge ms-badge--neutral">Fallback mock</span> : null}
          </div>
          <div className="ms-small" style={{ marginTop: 4 }}>
            {mlStatus?.connected ? "Conta conectada via OAuth Mercado Livre." : "Conecte sua conta para habilitar sincronização real de anúncios, preço e estoque."}
          </div>
        </div>
        <button className="ms-btn ms-btn--primary" onClick={() => setAuditMessage("Conexão Mercado Livre solicitada (preview).")}><Icon name="connect" size={16} /> Conectar conta</button>
        <button className="ms-btn ms-btn--secondary" onClick={() => setAuditMessage("Sincronização solicitada (preview). Nenhuma chamada real executada.")}><Icon name="sync" size={16} /> Sincronizar</button>
      </div>

      {/* Quick actions */}
      <div className="actions-grid ms-mt">
        {QUICK_ACTIONS.map((a) => (
          <button key={a.label} type="button" className="action-card" onClick={() => setAuditMessage(a.message)}>
            <div className="action-ico"><Icon name={a.icon} size={18} /></div>
            <div className="action-title">{a.label}</div>
            <div className="action-desc">{a.desc}</div>
          </button>
        ))}
      </div>

      {/* Selector */}
      <div className="ms-card ms-mt">
        <div className="ms-row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="ms-caps">Editando</div>
            <div className="ms-h3" style={{ marginTop: 4 }}>{detail?.name || "Selecione um produto"}</div>
          </div>
          <select className="ms-input" style={{ width: 360 }} value={selectedId} onChange={(e) => setSelectedId(e.target.value)} disabled={!products.length}>
            {products.length === 0 ? <option value="">Nenhum produto importado</option> : null}
            {products.map((p) => (<option key={p.id} value={p.id}>{p.name || "Produto sem nome"}</option>))}
          </select>
        </div>
      </div>

      {/* Editor + side */}
      <div className="editor-grid ms-mt">
        <div className="editor-pane">
          <div className="editor-head">
            <div>
              <div className="ms-caps">Editor de anúncio</div>
              <div className="ms-h3" style={{ marginTop: 4 }}>{detail?.name || "Anúncio em rascunho"}</div>
            </div>
            <div className="ms-row">
              <button className="ms-btn ms-btn--ghost ms-btn--sm" onClick={() => setAuditMessage("Rascunho descartado (preview).")}>Descartar</button>
              <button className="ms-btn ms-btn--secondary ms-btn--sm" onClick={() => setAuditMessage("Rascunho salvo localmente (preview).")}>Salvar rascunho</button>
              <button className="ms-btn ms-btn--primary ms-btn--sm" onClick={() => setAuditMessage("Publicação bloqueada nesta rodada (visual).")}>Publicar</button>
            </div>
          </div>
          <div className="editor-body">
            <div className="ed-row">
              <label className="ms-label">Título sugerido</label>
              <input className="ms-input" defaultValue={suggestedTitle} placeholder="Título técnico do anúncio" />
              <div className="ai-strip">
                <Icon name="wand" size={14} /> IA sugere termos de alto volume — aplique antes de publicar.
              </div>
            </div>
            <div className="ed-row cols">
              <div className="ed-row">
                <label className="ms-label">Preço de venda (R$)</label>
                <input className="ms-input" defaultValue={detail?.price ?? ""} placeholder="0,00" />
              </div>
              <div className="ed-row">
                <label className="ms-label">Estoque</label>
                <input className="ms-input" defaultValue={detail?.stock ?? 0} placeholder="0" />
              </div>
            </div>
            <div className="ed-row cols">
              <div className="ed-row">
                <label className="ms-label">Condição</label>
                <select className="ms-input"><option>Novo</option><option>Usado</option></select>
              </div>
              <div className="ed-row">
                <label className="ms-label">Tipo de anúncio</label>
                <select className="ms-input"><option>Clássico</option><option>Premium</option></select>
              </div>
            </div>
            <div className="ed-row">
              <label className="ms-label">Descrição</label>
              <textarea className="ms-textarea" defaultValue={baseDescription} />
              <div className="ai-strip"><Icon name="bolt" size={14} /> Gerar descrição completa com IA</div>
            </div>

            <CopyBlock title="Título com Inteligência ML" text={mlTitle} />
            <CopyBlock title="Palavras-chave" text={suggestedKeywords.join(", ")} />
            <CopyBlock title="Estratégia ML" text={mlStrategy} />
          </div>
        </div>

        <div className="ms-stack">
          <div className="preview-pane">
            <div className="preview-bar"><Icon name="audit" size={14} /> Preview · Mercado Livre</div>
            <div className="preview-content">
              <div className="preview-thumb">IMAGEM PRINCIPAL</div>
              <div className="preview-cond">Novo · {detail?.sales_60d ?? 0} vendas 60d</div>
              <h3 className="preview-title">{suggestedTitle || detail?.name || "Título do anúncio"}</h3>
              <div className="preview-price">{formatMoneyBRL(detail?.price)}</div>
              <div className="preview-installments">em 12x sem juros</div>
              <div className="preview-shipping"><Icon name="inventory" size={14} /> Frete GRÁTIS · entrega rápida</div>
            </div>
          </div>

          <div className="ms-card">
            <div className="ms-caps">Checklist de publicação</div>
            <div className="check-list" style={{ marginTop: 14 }}>
              {checklist.map((c) => <ChecklistItem key={c.label} {...c} />)}
            </div>
          </div>

          <div className="ms-card">
            <div className="ms-caps">Prioridades operacionais</div>
            <div className="prio-list" style={{ marginTop: 14 }}>
              {priorities.map((p) => (
                <div key={p.tag} className="prio-item">
                  <div className="prio-tag">{p.tag}</div>
                  <div className="prio-body">
                    <div className="t">{p.t}</div>
                    <div className="m">{p.m}</div>
                  </div>
                  <span className={`ms-badge ms-badge--${p.badge}`}>{p.badge === "neg" ? "Urgente" : p.badge === "warn" ? "Atenção" : p.badge === "brand" ? "Em fila" : "Backlog"}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="ms-card">
            <div className="ms-caps">Auditoria visual</div>
            <div className="audit-panel" style={{ marginTop: 12 }}>
              <span className="ms-badge ms-badge--warn">Sem publicação real</span>
              <p>{auditMessage}</p>
              <p>Compatibilidade, imagens e políticas do Mercado Livre devem ser revisadas manualmente antes da próxima fase.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
