import { useEffect, useState } from "react";
import { Icon } from "../components/ui/Icon";
import { api, getApiBaseURL } from "../services/api";

function Toggle({ on, onChange }) {
  return (
    <button type="button" className={`ms-toggle ${on ? "ms-toggle--on" : ""}`.trim()} onClick={() => onChange(!on)} aria-pressed={on} />
  );
}

const SECTIONS = [
  { id: "ml", label: "Conexão Mercado Livre", group: "Integrações" },
  { id: "api", label: "API · Backend", group: "Integrações" },
  { id: "import", label: "Importação", group: "Operação" },
  { id: "tema", label: "Tema", group: "Aparência" },
  { id: "workspace", label: "Workspace", group: "Workspace" },
  { id: "seguranca", label: "Segurança", group: "Workspace" },
  { id: "logs", label: "Logs", group: "Workspace" },
];

export function SettingsPage() {
  const [mlStatus, setMlStatus] = useState(null);
  const [active, setActive] = useState("ml");
  const [autoSync, setAutoSync] = useState(true);
  const [notifQa, setNotifQa] = useState(true);
  const [autoReprice, setAutoReprice] = useState(false);
  const [autoBackup, setAutoBackup] = useState(true);
  const [theme, setTheme] = useState("light");
  const [density, setDensity] = useState("comfortable");
  const apiBase = getApiBaseURL();

  useEffect(() => {
    api.get("/marketplaces/mercadolivre/status").then((res) => setMlStatus(res.data)).catch(() => {});
  }, []);

  const apiOk = Boolean(apiBase);
  const dbKind = mlStatus?.database?.url_kind;
  const dbLabel = dbKind === "postgres" ? "Postgres (cloud)" : dbKind === "sqlite" ? "SQLite (dev)" : "Desconhecido";
  const mlConfigured = Boolean(mlStatus?.configured);
  const mlConnected = Boolean(mlStatus?.connected);

  function scrollTo(id) {
    setActive(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const grouped = SECTIONS.reduce((acc, s) => {
    (acc[s.group] = acc[s.group] || []).push(s);
    return acc;
  }, {});

  return (
    <>
      <div className="ms-page-head">
        <div>
          <h1 className="ms-page-title">Configurações</h1>
          <p className="ms-page-desc">Gerencie integrações, preferências de importação, tema, workspace e segurança do MapaSeller.</p>
        </div>
      </div>

      <div className="cfg-grid">
        <aside className="cfg-nav">
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <div className="ms-caps">{group}</div>
              {items.map((s) => (
                <a key={s.id} className={active === s.id ? "is-active" : ""} onClick={() => scrollTo(s.id)}>{s.label}</a>
              ))}
            </div>
          ))}
        </aside>

        <div>
          {/* ML connection */}
          <section className="cfg-section" id="ml">
            <div className="cfg-section-head">
              <h2 className="cfg-section-title">Conexão Mercado Livre</h2>
              <p className="cfg-section-desc">Autenticação OAuth e permissões para sincronizar anúncios, preço e estoque.</p>
            </div>
            <div className="setting-row">
              <div>
                <div className="label">Status atual</div>
                <div className="desc">{mlConnected ? `Conta ativa${mlStatus?.nickname ? ` · ${mlStatus.nickname}` : ""}` : mlConfigured ? "OAuth configurado, conta não conectada" : "Backend em modo mock — variáveis de OAuth não configuradas"}</div>
              </div>
              <span className={`ms-badge ms-badge--${mlConnected ? "pos" : mlConfigured ? "warn" : "neutral"} ms-badge--dot`}>
                {mlConnected ? "Conectado" : mlConfigured ? "Pendente" : "Mock"}
              </span>
            </div>
            <div className="setting-row">
              <div>
                <div className="label">Sincronização automática</div>
                <div className="desc">Atualizar preço e estoque a cada hora.</div>
              </div>
              <Toggle on={autoSync} onChange={setAutoSync} />
            </div>
            <div className="setting-row">
              <div>
                <div className="label">Notificar perguntas pendentes</div>
                <div className="desc">Notificação quando houver pergunta sem resposta há mais de 4h.</div>
              </div>
              <Toggle on={notifQa} onChange={setNotifQa} />
            </div>
            <div className="setting-row">
              <div>
                <div className="label">Reprecificação automática</div>
                <div className="desc">Permite IA aplicar ajustes dentro da faixa de margem definida.</div>
              </div>
              <Toggle on={autoReprice} onChange={setAutoReprice} />
            </div>
          </section>

          {/* API status */}
          <section className="cfg-section" id="api">
            <div className="cfg-section-head">
              <h2 className="cfg-section-title">API · Backend</h2>
              <p className="cfg-section-desc">Saúde dos serviços e endpoint do backend usado pelo frontend.</p>
            </div>
            <div className="status-row">
              <div className={`status-cell ${apiOk ? "ok" : ""}`}>
                <div className="lab">API MapaSeller</div>
                <div className="val">{apiOk ? "Configurada" : "Sem baseURL"}</div>
                <div className="ms-meta" style={{ marginTop: 4, wordBreak: "break-all" }}>{apiBase}</div>
              </div>
              <div className={`status-cell ${mlConfigured ? "ok" : ""}`}>
                <div className="lab">OAuth Mercado Livre</div>
                <div className="val">{mlConfigured ? "Configurado" : "Mock"}</div>
                <div className="ms-meta" style={{ marginTop: 4 }}>Secret storage: {mlStatus?.secret_storage || "—"}</div>
              </div>
              <div className="status-cell">
                <div className="lab">Banco de dados</div>
                <div className="val">{dbLabel}</div>
                <div className="ms-meta" style={{ marginTop: 4 }}>{mlStatus?.database?.driver || "—"}</div>
              </div>
            </div>
          </section>

          {/* Import preferences */}
          <section className="cfg-section" id="import">
            <div className="cfg-section-head">
              <h2 className="cfg-section-title">Preferências de importação</h2>
              <p className="cfg-section-desc">Como o MapaSeller processa seu XLSX de vendidos e estoque.</p>
            </div>
            <div className="setting-row">
              <div>
                <div className="label">Estratégia de match de SKU</div>
                <div className="desc">Como reconciliar SKUs entre as abas Vendidos e Estoque.</div>
              </div>
              <div className="ms-row">
                <button className="ms-chip ms-chip--active">Exato + fuzzy</button>
                <button className="ms-chip">Só exato</button>
              </div>
            </div>
            <div className="setting-row">
              <div>
                <div className="label">Itens sem SKU</div>
                <div className="desc">Comportamento quando um item não tem código.</div>
              </div>
              <div className="ms-row">
                <button className="ms-chip ms-chip--active">Quarentena</button>
                <button className="ms-chip">Importar</button>
                <button className="ms-chip">Ignorar</button>
              </div>
            </div>
            <div className="setting-row">
              <div>
                <div className="label">Backup automático antes de importar</div>
                <div className="desc">Snapshot do estado atual antes de sobrescrever.</div>
              </div>
              <Toggle on={autoBackup} onChange={setAutoBackup} />
            </div>
          </section>

          {/* Theme */}
          <section className="cfg-section" id="tema">
            <div className="cfg-section-head">
              <h2 className="cfg-section-title">Tema</h2>
              <p className="cfg-section-desc">MapaSeller é light-first. Dark está em beta e disponível apenas para times convidados.</p>
            </div>
            <div className="theme-grid">
              <button type="button" className={`theme-card ${theme === "light" ? "is-active" : ""}`.trim()} onClick={() => setTheme("light")}>
                <div className="theme-preview"><div className="side" /><div className="body" /></div>
                <div className="theme-name">Light</div>
                <div className="theme-desc">Padrão · recomendado</div>
              </button>
              <button type="button" className={`theme-card dark ${theme === "dark" ? "is-active" : ""}`.trim()} onClick={() => setTheme("dark")}>
                <div className="theme-preview"><div className="side" /><div className="body" /></div>
                <div className="theme-name">Dark <span className="ms-badge-beta">Beta</span></div>
                <div className="theme-desc">Em refinamento</div>
              </button>
              <button type="button" className={`theme-card auto ${theme === "auto" ? "is-active" : ""}`.trim()} onClick={() => setTheme("auto")}>
                <div className="theme-preview" />
                <div className="theme-name">Automático</div>
                <div className="theme-desc">Segue o sistema</div>
              </button>
            </div>
            <div className="setting-row" style={{ marginTop: 8 }}>
              <div>
                <div className="label">Densidade da interface</div>
                <div className="desc">Mais compacta para telas grandes com muitos dados.</div>
              </div>
              <div className="ms-row">
                {["compact", "comfortable", "spacious"].map((d) => (
                  <button key={d} className={`ms-chip ${density === d ? "ms-chip--active" : ""}`.trim()} onClick={() => setDensity(d)}>
                    {d === "compact" ? "Compacta" : d === "comfortable" ? "Confortável" : "Espaçosa"}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Workspace */}
          <section className="cfg-section" id="workspace">
            <div className="cfg-section-head">
              <h2 className="cfg-section-title">Workspace</h2>
              <p className="cfg-section-desc">Informações da operação.</p>
            </div>
            <div className="setting-row">
              <div><div className="label">Nome do workspace</div><div className="desc">Aparece na sidebar e nos relatórios exportados.</div></div>
              <input className="ms-input" defaultValue="FM Auto Peças" style={{ width: 280 }} />
            </div>
            <div className="setting-row">
              <div><div className="label">Moeda padrão</div><div className="desc">Aplicada em todas as visualizações financeiras.</div></div>
              <input className="ms-input" defaultValue="BRL · Real (R$)" style={{ width: 220 }} />
            </div>
          </section>

          {/* Security */}
          <section className="cfg-section" id="seguranca">
            <div className="cfg-section-head">
              <h2 className="cfg-section-title">Segurança</h2>
              <p className="cfg-section-desc">Autenticação e auditoria do workspace.</p>
            </div>
            <div className="setting-row">
              <div><div className="label">2FA</div><div className="desc">Recomendado para o owner do workspace.</div></div>
              <span className="ms-badge ms-badge--neutral ms-badge--dot">Em breve</span>
            </div>
            <div className="setting-row">
              <div><div className="label">Exportar dados do workspace</div><div className="desc">JSON completo · vendas, produtos e configurações.</div></div>
              <button className="ms-btn ms-btn--secondary">Solicitar export</button>
            </div>
          </section>

          {/* Logs */}
          <section className="cfg-section" id="logs">
            <div className="cfg-section-head">
              <h2 className="cfg-section-title">Logs</h2>
              <p className="cfg-section-desc">Eventos básicos do sistema na sessão atual.</p>
            </div>
            <table className="log-table">
              <tbody>
                <tr>
                  <td className="log-time">agora</td>
                  <td className="log-level ok"><span className="pill">OK</span></td>
                  <td className="log-msg">Frontend conectado a <span className="mono">{apiBase}</span></td>
                </tr>
                <tr>
                  <td className="log-time">agora</td>
                  <td className={`log-level ${mlConnected ? "ok" : mlConfigured ? "warn" : "info"}`}><span className="pill">{mlConnected ? "OK" : mlConfigured ? "WARN" : "INFO"}</span></td>
                  <td className="log-msg">Status ML: <span className="mono">{mlConnected ? "conectado" : mlConfigured ? "OAuth pendente" : "mock local"}</span></td>
                </tr>
                <tr>
                  <td className="log-time">agora</td>
                  <td className="log-level info"><span className="pill">INFO</span></td>
                  <td className="log-msg">Banco em uso: <span className="mono">{dbLabel}</span></td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </>
  );
}
