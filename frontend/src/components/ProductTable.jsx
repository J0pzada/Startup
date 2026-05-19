import { Link } from "react-router-dom";
import { Badge } from "./Badge";
import { alertaTone, formatCode, formatMoneyBRL, scoreLabel, scoreTone } from "../services/formatters";

function originLabel(origem) {
  if (!origem) return "-";
  if (origem === "vendidos+estoque") return "Vendidos + Estoque";
  if (origem === "vendidos") return "Vendidos";
  if (origem === "estoque") return "Somente estoque";
  return origem;
}

export function ProductTable({ items = [] }) {
  return (
    <div className="table-wrap">
      <table className="premium-table">
        <thead>
          <tr>
            <th>Produto</th>
            <th>SKU/EAN</th>
            <th>Estoque</th>
            <th>Custo</th>
            <th>Preço</th>
            <th>Vendas 60d</th>
            <th>Score</th>
            <th>Prioridade</th>
            <th>Alerta</th>
            <th>Origem</th>
          </tr>
        </thead>
        <tbody>
          {items.map((product) => {
            const code = formatCode(product.sku) !== "-" ? formatCode(product.sku) : formatCode(product.ean);
            const isNegative = (product.stock || 0) < 0;
            const noSku = !product.sku || product.sku_status === "ausente" || product.sku_status === "codigo_suspeito";

            return (
              <tr key={product.id} className={isNegative ? "row-danger" : noSku ? "row-warning" : ""}>
                <td>
                  <Link to={`/produtos/${product.id}`} className="table-link">
                    {product.name || "Produto sem nome"}
                  </Link>
                  {product.brand ? <span className="table-subline">{product.brand}</span> : null}
                </td>
                <td>
                  <span>{code}</span>
                  {noSku ? <span className="table-subline danger">SKU ausente</span> : null}
                  {product.sku_status === "codigo_extraido" ? (
                    <span className="table-subline">Código extraído</span>
                  ) : null}
                </td>
                <td>
                  <span className={isNegative ? "danger" : ""}>{product.stock ?? 0}</span>
                  <span className="table-subline">{product.estoque_status || (product.stock > 0 ? "Com estoque" : "Sem estoque")}</span>
                </td>
                <td>{formatMoneyBRL(product.cost)}</td>
                <td>{formatMoneyBRL(product.price)}</td>
                <td>{product.sales_60d ?? 0}</td>
                <td>
                  <span className="score-pill">{product.score ?? 0}</span>
                </td>
                <td>
                  <Badge tone={scoreTone(product.status)}>{scoreLabel(product)}</Badge>
                </td>
                <td>
                  {product.alerta ? <Badge tone={alertaTone(product.alerta)}>{product.alerta}</Badge> : <span className="table-subline">-</span>}
                  <span className="table-subline">{originLabel(product.origem_importacao)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
