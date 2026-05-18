import { NavLink } from "react-router-dom";

const items = [
  { label: "Dashboard", to: "/" },
  { label: "Importar XLSX", to: "/importar" },
  { label: "Produtos", to: "/produtos" },
  { label: "Oportunidades", to: "/oportunidades" },
  { label: "Marketplaces", to: "/marketplaces" },
  { label: "Criador de Anúncios", to: "/anuncios" },
  { label: "Configurações", to: "/configuracoes" },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-slate-200 p-4">
      <h1 className="text-lg font-semibold text-slate-800 mb-6">Radar Marketplace FM</h1>
      <nav className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `block px-3 py-2 rounded-md text-sm ${
                isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
