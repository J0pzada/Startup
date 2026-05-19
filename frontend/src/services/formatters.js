export function formatMoneyBRL(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

export function formatCode(value) {
  if (!value) return "-";
  const text = String(value).trim();
  if (text.endsWith(".0") && /^-?\d+\.0$/.test(text)) return text.slice(0, -2);
  return text;
}

export function marginPct(cost, price) {
  if (cost == null || price == null || Number(price) <= 0) return null;
  return ((Number(price) - Number(cost)) / Number(price)) * 100;
}

export function scoreTone(status) {
  if (status === "announce_first") return "success";
  if (status === "good_opportunity") return "accent";
  if (status === "test_carefully") return "warning";
  if (status === "negative_stock") return "danger";
  if (status === "replenishment_urgent") return "danger";
  if (status === "stalled_stock") return "warning";
  if (status === "no_stock_general") return "warning";
  return "muted";
}

export function scoreLabel(product) {
  if (product.status === "negative_stock") return "Estoque negativo";
  if (product.status === "replenishment_urgent") return "Reposição urgente";
  if (product.status === "stalled_stock") return "Estoque parado";
  if (product.status === "no_stock_general") return "Sem estoque geral";
  return product.priority || "Revisar";
}

export function alertaTone(alerta) {
  if (!alerta) return "muted";
  if (alerta === "Estoque negativo") return "danger";
  if (alerta === "Reposição urgente") return "danger";
  if (alerta === "Estoque parado") return "warning";
  if (alerta === "Sem estoque geral") return "warning";
  if (alerta === "SKU ausente") return "warning";
  if (alerta === "Match fraco") return "muted";
  return "muted";
}

export function recommendAction(product) {
  if (product.alerta === "Estoque negativo") return "Ajustar inventário";
  if (product.alerta === "Reposição urgente") return "Repor estoque já";
  if (product.alerta === "Estoque parado") return "Promover ou liquidar";
  if (product.alerta === "Sem estoque geral") return "Confirmar disponibilidade";
  if (!formatCode(product.sku) || formatCode(product.sku) === "-") return "Revisar SKU";
  if (product.status === "announce_first") return "Preparar anúncio";
  if (product.status === "good_opportunity") return "Analisar concorrência";
  if (product.status === "test_carefully") return "Testar lote pequeno";
  return "Revisar";
}
