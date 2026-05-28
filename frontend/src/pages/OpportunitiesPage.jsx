import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/ui/Icon";
import { api } from "../services/api";
import { alertaTone, formatCode, formatMoneyBRL, marginPct, recommendAction, scoreLabel, scoreTone } from "../services/formatters";

const TONE_TO_BADGE = { success: "pos", accent: "brand", warning: "warn", danger: "neg", muted: "neutral" };
const badgeClass = (tone) => `ms-badge ms-badge--${TONE_TO_BADGE[tone] || "neutral"}`;

function priorityFor(p) {
  if (p.status === "announce_first" || p.status === "good_opportunity") return "high";
  if (p.alerta === "Reposição urgente" || p.alerta === "Estoque negativo") return "high";
  if (p.alerta === "Estoque parado" || p.alerta === "Sem estoque geral") return "med";
  return "low";
}

function ringStroke(score) {
  if (score >= 80) return "var(--ms-positive-fg)";
  if (score >= 55) return "var(--ms-brand-600)";
  return "var(--ms-warning-fg)";
}

function ScoreRing({ score }) {
  const value = Math.max(0, Math.min(100, score || 0));
  return (
    <div className="opp-score-ring">
      <svg viewBox="0 0 42 42" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="21" cy="21" r="18" fill="none" stroke="var(--ms-surface-2)" strokeWidth="4" />
        <circle cx="21" cy="21" r="18" fill="none" stroke={ringStroke(value)} strokeWidth="4" strokeDasharray={`${value} 100`} pathLength="100" strokeLinecap="round" />
      </svg>
      <div className="opp-score-num">{value}</div>
    </div>
  );
}

const FILTERS = [
  { key: "all", label: "Todos" },
  { key: "announce_first", label: "Anunciar" },
  { key: "good_opportunity", label: "Boa oportunidade" },
  { key: "Reposição urgente", label: "Reposição" },
  { key: "Estoque parado", label: "Estoque parado" },
];

export function OpportunitiesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    setLoading(true);
    api.get("/products", { params: { limit: 500, offset: 0 } })
      .then((res) => setItems(res.data.items || []))
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(() => [...items].sort((a, b) => (b.score || 0) - (a.score || 0)), [items]);
  const leader = sorted[0];
  const counts = useMemo(() => ({
    all: items.length,
    announce_first: items.filter((p) => p.status === "announce_first").length,
    good_opportunity: items.filter((p) => p.status === "good_opportunity").length,
    repos: items.filter((p) => p.alerta === "Reposição urgente").length,
    parado: items.filter((p) => p.alerta === "Estoque parado").length,
    reviewSku: items.filter((p) => !p.sku || p.sku_status === "ausente" || p.sku_status === "codigo_suspeito").length,
  }), [items]);

  const filtered = useMemo(() => {
    if (filter === "all") return sorted;
    if (filter === "announce_first" || filter === "good_opportunity") return sorted.filter((p) => p.status === filter);
    return sorted.filter((p) => p.alerta === filter);
  }, [sorted, filter]);

  return (
    <>
      <div className="ms-page-head">
        <div>
          <h1 className="ms-page-title">Oportunidades</h1>
          <p className="ms-page-desc">Painel de decisão para acelerar anúncios, reposição e revisão de catálogo.</p>
        </div>
      </div>

      {loading ? (
        <div className="ms-skeleton" style={{ height: 200 }} />
      ) : items.length === 0 ? (
        <div className="ms-card">
          <div className="ms-empty">
            <div className="ms-empty-ico"><Icon name="opportunities" size={26} /></div>
            <h3 className="ms-empty-title">Sem dados para análise</h3>
            <p className="ms-empty-desc">Importe produtos para habilitar a trilha de oportunidades.</p>
            <Link className="ms-btn ms-btn--primary" to="/importar"><Icon name="upload" size={16} /> Importar planilha</Link>
          </div>
        </div>
      ) : (
        <>
          {leader ? (
            <div className="leader-card">
              <div>
                <p className="eyebrow">Oportunidade #1 da base</p>
                <h2>{leader.name || "Produto sem nome"}</h2>
                <p>
                  Score {leader.score ?? 0} · {formatMoneyBRL(leader.price)} · estoque {leader.stock ?? 0}.
                  Recomendação: <strong style={{ color: "#fff" }}>{recommendAction(leader)}</strong>.
                </p>
                <div className="ms-row" style={{ marginTop: 20 }}>
                  <Link to={`/produtos/${leader.id}`} className="ms-btn" style={{ background: "#fff", color: "var(--ms-brand-700)" }}>
                    Ver detalhe <Icon name="arrowUp" size={14} />
                  </Link>
                  <Link to="/marketplaces/mercadolivre" className="ms-btn" style={{ background: "rgba(255,255,255,.12)", color: "#fff", borderColor: "rgba(255,255,255,.2)" }}>
                    Analisar no ML
                  </Link>
                </div>
              </div>
              <div className="leader-stats">
                <div className="leader-stat"><div className="lab">Score</div><div className="val">{leader.score ?? 0}</div></div>
                <div className="leader-stat"><div className="lab">Preço</div><div className="val">{formatMoneyBRL(leader.price)}</div></div>
                <div className="leader-stat"><div className="lab">Estoque</div><div className="val">{leader.stock ?? 0}</div></div>
                <div className="leader-stat"><div className="lab">Vendas 60d</div><div className="val">{leader.sales_60d ?? 0}</div></div>
              </div>
            </div>
          ) : null}

          <div className="opp-summary ms-mt">
            <div className="opp-summary-cell"><span>Anunciar primeiro</span><strong>{counts.announce_first}</strong></div>
            <div className="opp-summary-cell"><span>Boa oportunidade</span><strong>{counts.good_opportunity}</strong></div>
            <div className="opp-summary-cell"><span>Reposição urgente</span><strong>{counts.repos}</strong></div>
            <div className="opp-summary-cell"><span>Estoque parado</span><strong>{counts.parado}</strong></div>
            <div className="opp-summary-cell"><span>Revisar SKU</span><strong>{counts.reviewSku}</strong></div>
          </div>

          <div className="ms-row ms-mt" style={{ gap: 8 }}>
            <span className="ms-caps" style={{ marginRight: 4 }}>Filtros</span>
            {FILTERS.map((f) => (
              <button key={f.key} className={`ms-chip ${filter === f.key ? "ms-chip--active" : ""}`.trim()} onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="opp-grid ms-mt">
            {filtered.slice(0, 18).map((p, idx) => {
              const m = marginPct(p.cost, p.price);
              const prio = priorityFor(p);
              const code = formatCode(p.sku) !== "-" ? formatCode(p.sku) : formatCode(p.ean);
              return (
                <div key={p.id} className="opp-card">
                  <div className="opp-head">
                    <div className="opp-thumb">IMG</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="opp-rank">#{String(idx + 1).padStart(2, "0")} · {scoreLabel(p)}</div>
                      <div className="opp-title">{p.name || "Produto sem nome"}</div>
                    </div>
                    <span className={`opp-prio opp-prio--${prio}`}>{prio === "high" ? "Alta" : prio === "med" ? "Média" : "Baixa"}</span>
                  </div>
                  <div className="opp-body">
                    <div className="opp-score-row">
                      <ScoreRing score={p.score} />
                      <div>
                        <div className="opp-meta">Score de oportunidade</div>
                        <div style={{ fontSize: 13, color: "var(--ms-text)", fontWeight: 500 }}>{recommendAction(p)}</div>
                      </div>
                    </div>
                    <div className="opp-reason">
                      <strong>Por quê:</strong>{" "}
                      {p.alerta
                        ? `${p.alerta}.`
                        : p.status === "announce_first"
                          ? "Sinal comercial forte — pronto para preparar anúncio."
                          : p.status === "good_opportunity"
                            ? "Bom desempenho recente, vale analisar a concorrência."
                            : "Produto na fila de revisão operacional."}
                    </div>
                    <div className="opp-stats">
                      <div className="opp-stat"><div className="lab">Preço</div><div className="val">{formatMoneyBRL(p.price)}</div><div className="sub">venda</div></div>
                      <div className="opp-stat"><div className="lab">Margem</div><div className="val">{m == null ? "—" : `${m.toFixed(0)}%`}</div><div className="sub">{m == null ? "n/d" : "estimada"}</div></div>
                      <div className="opp-stat"><div className="lab">Estoque</div><div className="val">{p.stock ?? 0}</div><div className="sub">60d {p.sales_60d ?? 0}</div></div>
                    </div>
                  </div>
                  <div className="opp-foot">
                    <span className="ms-meta">SKU {code}</span>
                    {p.alerta ? <span className={badgeClass(alertaTone(p.alerta))}>{p.alerta}</span> : null}
                    <Link to={`/produtos/${p.id}`} className="ms-btn ms-btn--primary ms-btn--sm" style={{ marginLeft: "auto" }}>
                      Abrir
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
