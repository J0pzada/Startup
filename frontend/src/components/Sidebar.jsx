import { NavLink } from "react-router-dom";

const items = [
  { label: "Dashboard", to: "/", icon: "D" },
  { label: "Importar XLSX", to: "/importar", icon: "I" },
  { label: "Produtos", to: "/produtos", icon: "P" },
  { label: "Oportunidades", to: "/oportunidades", icon: "O" },
  { label: "Marketplaces", to: "/marketplaces", icon: "M" },
  { label: "Anúncios", to: "/anuncios", icon: "A" },
  { label: "Configurações", to: "/configuracoes", icon: "C" },
];

export function Sidebar() {
  return (
    <aside className="sidebar glass-panel">
      <div className="brand">
        <div className="brand-mark">MS</div>
        <div>
          <h1>MapaSeller</h1>
          <p>Analytics Console</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-link ${isActive ? "is-active" : ""}`.trim()}
          >
            <span className="sidebar-icon" aria-hidden="true">
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <p>FM Auto Peças</p>
        <span>Operational workspace</span>
      </div>
    </aside>
  );
}
