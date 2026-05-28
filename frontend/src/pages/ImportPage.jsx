import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/ui/Icon";
import { api, formatApiError } from "../services/api";
import { formatMoneyBRL } from "../services/formatters";

function humanSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const STEPS = [
  { key: "upload", title: "Upload do arquivo", desc: "Selecione o XLSX de vendidos e estoque." },
  { key: "preview", title: "Pré-visualização", desc: "Revise o mapeamento detectado antes de confirmar." },
  { key: "confirm", title: "Confirmar importação", desc: "Os dados serão gravados no workspace." },
  { key: "done", title: "Concluído", desc: "Score recalculado e base atualizada." },
];

export function ImportPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);
  const [loadingClear, setLoadingClear] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const currentStep = result ? "done" : preview ? "confirm" : file ? "preview" : "upload";
  const stepIndex = STEPS.findIndex((s) => s.key === currentStep);

  function pickFile(f) {
    if (!f) return;
    setFile(f);
    setPreview(null);
    setResult(null);
    setError("");
  }

  async function onPreview() {
    if (!file) return;
    setError("");
    setLoadingPreview(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await api.post("/upload-xlsx/preview", form, { timeout: 120_000 });
      setPreview(res.data);
      setResult(null);
    } catch (err) {
      setError(formatApiError(err, err.response ? "Falha ao gerar preview da planilha." : "Erro de rede ou timeout: não foi possível conectar ao servidor."));
    } finally {
      setLoadingPreview(false);
    }
  }

  async function onConfirmImport() {
    if (!file) return;
    setError("");
    setLoadingImport(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await api.post("/upload-xlsx", form, { timeout: 180_000 });
      setResult(res.data);
    } catch (err) {
      setError(formatApiError(err, err.response ? "Falha ao importar planilha." : "Erro de rede ou timeout ao importar. Tente novamente."));
    } finally {
      setLoadingImport(false);
    }
  }

  async function onClearProducts() {
    if (!window.confirm("Tem certeza que deseja apagar todos os produtos importados da base local?")) return;
    setError("");
    setLoadingClear(true);
    try {
      await api.delete("/products");
      setResult({ imported: 0, message: "Base local limpa com sucesso." });
      setPreview(null);
      setFile(null);
    } catch (err) {
      setError(formatApiError(err, "Falha ao limpar produtos."));
    } finally {
      setLoadingClear(false);
    }
  }

  const diagnostics = useMemo(() => preview?.diagnostico_abas || [], [preview]);
  const columns = preview?.colunas_detectadas ?? preview?.detected_columns;

  return (
    <>
      <div className="ms-page-head">
        <div>
          <h1 className="ms-page-title">Importar planilha</h1>
          <p className="ms-page-desc">Faça upload do seu XLSX de vendidos e estoque. Detectamos as abas, sugerimos o mapeamento e mostramos um preview antes de gravar nada no banco.</p>
        </div>
        <div className="ms-page-actions">
          <button className="ms-btn ms-btn--danger" onClick={onClearProducts} disabled={loadingClear}>
            <Icon name="close" size={16} /> {loadingClear ? "Limpando…" : "Limpar produtos"}
          </button>
        </div>
      </div>

      <div className="imp-grid">
        <div className="ms-stack">
          <div className="ms-card">
            {!file ? (
              <div
                className={`ms-dropzone ${dragActive ? "ms-dropzone--active" : ""}`.trim()}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => { e.preventDefault(); setDragActive(false); pickFile(e.dataTransfer.files?.[0]); }}
                role="button"
                tabIndex={0}
              >
                <div className="ms-dropzone-ico"><Icon name="upload" size={28} /></div>
                <div>
                  <h3 className="ms-dropzone-title">Arraste seu XLSX aqui</h3>
                  <p className="ms-dropzone-desc">ou clique para selecionar · arquivos .xlsx</p>
                </div>
                <span className="ms-btn ms-btn--secondary">Selecionar arquivo</span>
                <input ref={inputRef} type="file" accept=".xlsx" style={{ display: "none" }} onChange={(e) => pickFile(e.target.files?.[0])} />
              </div>
            ) : (
              <div className="ms-stack">
                <div className="ms-caps">Arquivo carregado</div>
                <div className="file-row">
                  <div className="ico"><Icon name="file" size={20} /></div>
                  <div className="info">
                    <div className="name">{file.name}</div>
                    <div className="meta">{humanSize(file.size)} · pronto para análise</div>
                  </div>
                  {preview ? <span className="ms-badge ms-badge--pos ms-badge--dot">Analisado</span> : <span className="ms-badge ms-badge--neutral ms-badge--dot">Aguardando</span>}
                  <button className="ms-btn ms-btn--icon" aria-label="Remover" onClick={() => { setFile(null); setPreview(null); setResult(null); setError(""); }}>
                    <Icon name="close" size={16} />
                  </button>
                </div>
                <div className="ms-row">
                  <button className="ms-btn ms-btn--secondary" onClick={onPreview} disabled={loadingPreview}>
                    <Icon name="audit" size={16} /> {loadingPreview ? "Analisando…" : "Analisar planilha"}
                  </button>
                  <button className="ms-btn ms-btn--primary" onClick={onConfirmImport} disabled={!preview || loadingImport}>
                    <Icon name="check" size={16} /> {loadingImport ? "Importando…" : "Confirmar importação"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {error ? (
            <div className="ms-error">
              <Icon name="alert" size={18} />
              <div>
                <p className="ms-error-title">Erro no fluxo de importação</p>
                <p className="ms-error-msg">{error}</p>
              </div>
            </div>
          ) : null}

          {loadingPreview && !preview ? (
            <div className="ms-card ms-stack-sm">
              <div className="ms-skeleton" style={{ height: 14, width: "80%" }} />
              <div className="ms-skeleton" style={{ height: 14, width: "60%" }} />
              <div className="ms-skeleton" style={{ height: 14, width: "70%" }} />
              <div className="ms-progress"><div className="ms-progress-fill" style={{ width: "60%" }} /></div>
            </div>
          ) : null}

          {preview ? (
            <div className="ms-card ms-card--flush">
              <div style={{ padding: 24 }}>
                <div className="ms-caps" style={{ marginBottom: 12 }}>Resumo da análise</div>
                <div className="summary-row">
                  <div className="summary-cell"><div className="lab">Tipo detectado</div><div className="val" style={{ fontSize: 16 }}>{preview.tipo_detectado || "-"}</div></div>
                  <div className="summary-cell"><div className="lab">Produtos válidos</div><div className="val">{(preview.produtos_validos ?? preview.total_rows_processed ?? 0).toLocaleString("pt-BR")}</div></div>
                  <div className="summary-cell"><div className="lab">Linhas ignoradas</div><div className="val">{(preview.linhas_ignoradas ?? 0).toLocaleString("pt-BR")}</div></div>
                  <div className="summary-cell"><div className="lab">Abas processadas</div><div className="val">{preview.abas_lidas?.length || 0}</div></div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--ms-line)", padding: "18px 24px" }}>
                <div className="ms-caps">Preview</div>
                <div className="ms-h3" style={{ margin: "4px 0 0" }}>Primeiras linhas detectadas</div>
              </div>
              <div className="ms-table-wrap">
                <table className="ms-table">
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 24 }}>Produto</th>
                      <th>SKU</th>
                      <th className="ms-right">Estoque</th>
                      <th className="ms-right">Custo</th>
                      <th className="ms-right">Preço</th>
                      <th className="ms-right" style={{ paddingRight: 24 }}>Vendas 60d</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(preview.preview_rows || []).map((row, idx) => (
                      <tr key={`${row.sku || row.name}-${idx}`}>
                        <td style={{ paddingLeft: 24 }}>{row.name || "-"}</td>
                        <td className="ms-num">{row.sku || row.ean || "—"}</td>
                        <td className={`ms-right ms-num ${row.stock < 0 ? "ms-neg" : ""}`}>{row.stock ?? 0}</td>
                        <td className="ms-right ms-num">{formatMoneyBRL(row.cost)}</td>
                        <td className="ms-right ms-num">{formatMoneyBRL(row.price)}</td>
                        <td className="ms-right ms-num" style={{ paddingRight: 24 }}>{row.sales_60d ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ padding: 24, borderTop: "1px solid var(--ms-line)" }}>
                <div className="ms-alert ms-alert--warn">
                  <Icon name="alert" size={18} />
                  <div><strong>Atenção:</strong> confirmar a importação atualiza a base de Vendidos e Estoque. Revise o mapeamento detectado antes de prosseguir.</div>
                </div>
                {columns ? (
                  <div className="ms-jsonblock" style={{ marginTop: 14 }}>
                    <div className="ms-caps" style={{ marginBottom: 8 }}>Mapeamento de colunas</div>
                    <pre>{JSON.stringify(columns, null, 2)}</pre>
                  </div>
                ) : null}
                {diagnostics.length ? (
                  <>
                    <div className="ms-caps" style={{ margin: "18px 0 12px" }}>Diagnóstico por aba</div>
                    <div className="diagnostic-grid">
                      {diagnostics.slice(0, 12).map((d) => (
                        <div key={d.aba} className="diagnostic-item">
                          <strong>{d.aba}</strong>
                          <span>{d.tipo_detectado}</span>
                          <span>Válidas: {d.linhas_validas}</span>
                          <span>Ignoradas: {d.linhas_ignoradas}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          {result ? (
            <div className="ms-card">
              <div className="ms-empty" style={{ padding: "16px 0 24px" }}>
                <div className="ms-empty-ico" style={{ background: "var(--ms-positive-bg)", color: "var(--ms-positive-fg)" }}>
                  <Icon name="check" size={26} />
                </div>
                <h3 className="ms-empty-title">
                  {typeof result.imported === "number" && result.imported > 0
                    ? `${result.imported.toLocaleString("pt-BR")} linhas processadas`
                    : result.message || "Operação concluída"}
                </h3>
                {result.message && result.imported ? <p className="ms-empty-desc">{result.message}</p> : null}
                {result.merge_mode ? (
                  <p className="ms-empty-desc">
                    Planilha tratada como <strong>{result.merge_mode === "estoque" ? "Estoque (merge por SKU)" : "Vendidos (base do ranking)"}</strong>.
                  </p>
                ) : null}
                <div className="ms-row" style={{ justifyContent: "center" }}>
                  <button className="ms-btn ms-btn--secondary" onClick={() => { setFile(null); setPreview(null); setResult(null); }}>Importar outra</button>
                  <Link className="ms-btn ms-btn--primary" to="/produtos">Ver produtos</Link>
                </div>
              </div>
              {typeof result.imported === "number" && result.imported > 0 ? (
                <div className="summary-row">
                  <div className="summary-cell"><div className="lab">Inseridos</div><div className="val">{result.inserted ?? 0}</div></div>
                  <div className="summary-cell"><div className="lab">Atualizados</div><div className="val">{result.updated ?? 0}</div></div>
                  <div className="summary-cell"><div className="lab">Match SKU</div><div className="val">{result.sku_matches ?? 0}</div></div>
                  <div className="summary-cell"><div className="lab">Total na base</div><div className="val">{result.total_after ?? "-"}</div></div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="ms-stack">
          <div className="ms-card">
            <div className="ms-caps">Etapas</div>
            <div className="step-list" style={{ marginTop: 16 }}>
              {STEPS.map((step, idx) => {
                const state = idx < stepIndex ? "is-done" : idx === stepIndex ? "is-active" : "";
                return (
                  <div key={step.key} className={`step ${state}`.trim()}>
                    <div className="num">{idx < stepIndex ? <Icon name="check" size={14} /> : idx + 1}</div>
                    <div>
                      <div className="title">{step.title}</div>
                      <div className="desc">{step.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="ms-card">
            <div className="ms-caps">Boas práticas</div>
            <ul style={{ margin: "12px 0 0", paddingLeft: 18, color: "var(--ms-text)", fontSize: 13, lineHeight: 1.7 }}>
              <li>Exporte o XLSX direto do painel do marketplace.</li>
              <li>Mantenha a aba de SKUs como dicionário canônico.</li>
              <li>Use SKU pai/filho quando houver variações.</li>
              <li>Itens sem SKU vão para revisão antes de entrar na base.</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
