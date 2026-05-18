import { useState } from "react";
import { api } from "../services/api";

export function ImportPage() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await api.post("/upload-xlsx", form);
      setResult(res.data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-slate-800 mb-6">Importar XLSX</h2>
      <form onSubmit={onSubmit} className="bg-white border border-slate-200 rounded-lg p-6 max-w-2xl">
        <input
          type="file"
          accept=".xlsx"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm"
        />
        <button
          type="submit"
          disabled={!file || loading}
          className="mt-4 px-4 py-2 rounded-md bg-slate-900 text-white disabled:opacity-40"
        >
          {loading ? "Importando..." : "Importar Planilha"}
        </button>
      </form>
      {result && (
        <div className="mt-6 bg-white border border-slate-200 rounded-lg p-5">
          <p className="font-medium text-slate-800">Importação concluída</p>
          <p className="text-sm text-slate-600 mt-1">Produtos importados: {result.imported}</p>
          <pre className="mt-3 text-xs bg-slate-100 p-3 rounded overflow-auto">
            {JSON.stringify(result.column_mapping, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
