import { useMemo, useState } from "react";
import { ActionButton } from "../components/ActionButton";
import { AlertCard } from "../components/AlertCard";
import { EmptyState } from "../components/EmptyState";
import { PremiumCard } from "../components/PremiumCard";
import { SectionHeader } from "../components/SectionHeader";
import { api } from "../services/api";
import { formatMoneyBRL } from "../services/formatters";

function StatPill({ label, value }) {
  return (
    <div className="stat-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ImportPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);
  const [loadingClear, setLoadingClear] = useState(false);
  const [error, setError] = useState("");

  async function onPreview(e) {
    e.preventDefault();
    if (!file) return;

    setError("");
    setLoadingPreview(true);
    const form = new FormData();
    form.append("file", file);

    try {
      const res = await api.post("/upload-xlsx/preview", form);
      setPreview(res.data);
      setResult(null);
    } catch (err) {
      setError(err?.response?.data?.detail || "Falha ao gerar preview da planilha.");
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
      const res = await api.post("/upload-xlsx", form);
      setResult(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || "Falha ao importar planilha.");
    } finally {
      setLoadingImport(false);
    }
  }

  async function onClearProducts() {
    const confirmed = window.confirm("Tem certeza que deseja apagar todos os produtos importados da base local?");
    if (!confirmed) return;

    setError("");
    setLoadingClear(true);
    try {
      await api.delete("/products");
      setResult({ imported: 0, message: "Base local limpa com sucesso." });
      setPreview(null);
    } catch (err) {
      setError(err?.response?.data?.detail || "Falha ao limpar produtos.");
    } finally {
      setLoadingClear(false);
    }
  }

  const diagnostics = useMemo(() => preview?.diagnostico_abas || [], [preview]);

  return (
    <div className="page-grid">
      <SectionHeader
        title="Importação XLSX"
        description="Fluxo validado para análise prévia, confirmação de carga e limpeza segura da base local."
      />

      <PremiumCard className="upload-card">
        <form onSubmit={onPreview}>
          <label className="input-file-label">
            <span>Selecione a planilha da FM Auto Peças</span>
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setPreview(null);
                setResult(null);
                setError("");
              }}
            />
          </label>

          <div className="button-row">
            <ActionButton type="submit" disabled={!file || loadingPreview} variant="primary" icon="A">
              {loadingPreview ? "Analisando..." : "Analisar planilha"}
            </ActionButton>
            <ActionButton type="button" onClick={onConfirmImport} disabled={!file || !preview || loadingImport} variant="success" icon="I">
              {loadingImport ? "Importando..." : "Confirmar importação"}
            </ActionButton>
            <ActionButton type="button" onClick={onClearProducts} disabled={loadingClear} variant="danger" icon="X">
              {loadingClear ? "Limpando..." : "Limpar produtos importados"}
            </ActionButton>
          </div>
        </form>
      </PremiumCard>

      {error ? <AlertCard title="Erro no fluxo de importação" description={error} tone="danger" badge="Falha" /> : null}

      {preview ? (
        <PremiumCard>
          <SectionHeader title="Preview estruturado" description="Confira mapeamento detectado e amostra antes de confirmar importação." />

          <div className="pill-grid">
            <StatPill label="Tipo detectado" value={preview.tipo_detectado || "-"} />
            <StatPill label="Produtos válidos" value={preview.produtos_validos ?? preview.total_rows_processed ?? 0} />
            <StatPill label="Linhas ignoradas" value={preview.linhas_ignoradas ?? 0} />
            <StatPill label="Abas processadas" value={preview.abas_lidas?.length || 0} />
          </div>

          <div className="json-block">
            <h4>Mapeamento de colunas</h4>
            <pre>{JSON.stringify(preview.colunas_detectadas ?? preview.detected_columns, null, 2)}</pre>
          </div>

          <div className="table-wrap">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>SKU</th>
                  <th>Estoque</th>
                  <th>Custo unitário</th>
                  <th>Preço unitário</th>
                  <th>Vendas 60d</th>
                </tr>
              </thead>
              <tbody>
                {(preview.preview_rows || []).map((row, idx) => (
                  <tr key={`${row.sku || row.name}-${idx}`}>
                    <td>{row.name || "-"}</td>
                    <td>{row.sku || row.ean || "-"}</td>
                    <td className={row.stock < 0 ? "danger" : ""}>{row.stock ?? 0}</td>
                    <td>{formatMoneyBRL(row.cost)}</td>
                    <td>{formatMoneyBRL(row.price)}</td>
                    <td>{row.sales_60d ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="diagnostic-box">
            <h4>Diagnóstico por aba</h4>
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
          </div>
        </PremiumCard>
      ) : (
        <EmptyState title="Aguardando arquivo" description="Carregue uma planilha para habilitar o preview inteligente de importação." />
      )}

      {result ? (
        <PremiumCard>
          <SectionHeader title="Resultado da importação" description="Operação concluída com feedback imediato para nova rodada de testes." />
          {result.message ? <p className="muted-line">{result.message}</p> : null}
          {result.merge_mode === "estoque" ? (
            <p className="muted-line">
              Planilha tratada como <strong>Estoque</strong> (complemento/merge). Produtos existentes foram atualizados por SKU.
            </p>
          ) : null}
          {result.merge_mode === "vendidos" ? (
            <p className="muted-line">
              Planilha tratada como <strong>Vendidos</strong> (base principal do ranking).
            </p>
          ) : null}
          {typeof result.imported === "number" ? (
            <p className="result-highlight">Linhas processadas: {result.imported}</p>
          ) : null}
          <div className="pill-grid">
            <StatPill label="Inseridos" value={result.inserted ?? 0} />
            <StatPill label="Atualizados (merge)" value={result.updated ?? 0} />
            <StatPill label="Match por SKU" value={result.sku_matches ?? 0} />
            <StatPill label="Match por nome" value={result.nome_matches ?? 0} />
            <StatPill label="Só estoque (novos)" value={result.novos_so_estoque ?? 0} />
            <StatPill label="Total base agora" value={result.total_after ?? "-"} />
          </div>
        </PremiumCard>
      ) : null}
    </div>
  );
}
