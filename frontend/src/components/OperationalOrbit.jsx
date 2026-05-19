import { useMemo, useState } from "react";
import { Badge } from "./Badge";

const stageTone = {
  completed: "success",
  active: "accent",
  warning: "warning",
  danger: "danger",
  pending: "muted",
};

const stageLabel = {
  completed: "OK",
  active: "Ativo",
  warning: "Atencao",
  danger: "Critico",
  pending: "Fila",
};

function formatMetric(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("pt-BR");
}

export function OperationalOrbit({ metrics = {} }) {
  const [activeId, setActiveId] = useState("score");
  const [isPaused, setIsPaused] = useState(false);

  const stages = useMemo(
    () => [
      {
        id: "import",
        title: "Importacao",
        short: "IM",
        status: metrics.totalProducts > 0 ? "completed" : "pending",
        metric: formatMetric(metrics.totalProducts),
        label: "produtos na base",
        detail: "Planilhas multi-abas entram no console sem alterar a regra XLSX.",
      },
      {
        id: "normalize",
        title: "Normalizacao",
        short: "NM",
        status: metrics.missingSku > 0 ? "warning" : "completed",
        metric: formatMetric(metrics.missingSku),
        label: "sem SKU",
        detail: "Cadastro tecnico precisa de SKU/EAN limpo para reduzir falhas de publicacao.",
      },
      {
        id: "score",
        title: "Score",
        short: "SC",
        status: metrics.highScore > 0 ? "active" : "pending",
        metric: formatMetric(metrics.highScore),
        label: "score alto",
        detail: "Priorizacao combina venda recente, estoque, margem e qualidade de cadastro.",
      },
      {
        id: "stock",
        title: "Estoque",
        short: "ES",
        status: metrics.negativeStock > 0 ? "danger" : "completed",
        metric: formatMetric(metrics.negativeStock),
        label: "negativos",
        detail: "Divergencias de inventario ficam bloqueadas antes de ganhar escala.",
      },
      {
        id: "opportunities",
        title: "Oportunidades",
        short: "OP",
        status: metrics.opportunities > 0 ? "active" : "pending",
        metric: formatMetric(metrics.opportunities),
        label: "prioridades",
        detail: "Itens prontos para acao entram na fila de decisao comercial.",
      },
      {
        id: "ads",
        title: "Anuncios",
        short: "AN",
        status: metrics.sold60d > 0 ? "active" : "warning",
        metric: formatMetric(metrics.sold60d),
        label: "vendidos 60d",
        detail: "Conteudo de anuncio usa contexto operacional e alerta de compatibilidade.",
      },
      {
        id: "marketplace",
        title: "Marketplace",
        short: "MK",
        status: "pending",
        metric: formatMetric(metrics.marketplaces || 4),
        label: "simulados",
        detail: "Conectores reais seguem fora do MVP; o painel mostra apenas cenarios mockados.",
      },
    ],
    [metrics]
  );

  const activeStage = stages.find((stage) => stage.id === activeId) || stages[0];
  const orbitRadius = 136;

  return (
    <section
      className={`operational-orbit ${isPaused ? "is-paused" : ""}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="orbit-header">
        <div>
          <span className="eyebrow">Pipeline de inteligencia</span>
          <h3>Mapa operacional</h3>
        </div>
        <Badge tone={stageTone[activeStage.status]}>{stageLabel[activeStage.status]}</Badge>
      </div>

      <div className="orbit-stage">
        <div className="orbit-core">
          <span>MS</span>
          <strong>{activeStage.metric}</strong>
          <small>{activeStage.label}</small>
        </div>
        <div className="orbit-ring orbit-ring-a" />
        <div className="orbit-ring orbit-ring-b" />
        <div className="orbit-path">
          {stages.map((stage, index) => {
            const angle = (index / stages.length) * 360;
            const radian = (angle * Math.PI) / 180;
            const style = {
              "--orbit-x": `${Math.round(Math.cos(radian) * orbitRadius)}px`,
              "--orbit-y": `${Math.round(Math.sin(radian) * orbitRadius)}px`,
            };
            const isActive = activeStage.id === stage.id;
            return (
              <button
                type="button"
                key={stage.id}
                className={`orbit-node orbit-node-${stage.status} ${isActive ? "is-active" : ""}`}
                style={style}
                onClick={() => {
                  setActiveId(stage.id);
                  setIsPaused(true);
                }}
                aria-label={`Abrir etapa ${stage.title}`}
              >
                <span>{stage.short}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="orbit-detail">
        <div>
          <span>{activeStage.title}</span>
          <strong>{activeStage.metric}</strong>
          <small>{activeStage.label}</small>
        </div>
        <p>{activeStage.detail}</p>
      </div>
    </section>
  );
}
