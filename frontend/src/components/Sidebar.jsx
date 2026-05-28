import { NavLink } from "react-router-dom";
import { Icon } from "./ui/Icon";

const GROUPS = [
  {
    label: "Operação",
    items: [
      { label: "Dashboard", to: "/", icon: "dashboard", end: true },
      { label: "Importar XLSX", to: "/importar", icon: "import" },
      { label: "Produtos", to: "/produtos", icon: "products" },
      { label: "Oportunidades", to: "/oportunidades", icon: "opportunities" },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { label: "Marketplaces", to: "/marketplaces", icon: "marketplaces" },
      { label: "Inteligência ML", to: "/marketplaces/mercadolivre", icon: "mercadolivre" },
      { label: "Anúncios", to: "/anuncios", icon: "ads" },
    ],
  },
  {
    label: "Sistema",
    items: [{ label: "Configurações", to: "/configuracoes", icon: "settings" }],
  },
];

function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 3c-5 0-9 3.8-9 8.6 0 5.8 6.4 11.7 8.4 13.4.4.3.9.3 1.3 0 2-1.7 8.3-7.6 8.3-13.4C25 6.8 21 3 16 3Z" stroke="#5B5BF0" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M12 13l3-3 2.5 2.5L21 9M18 9h3v3" stroke="#5B5BF0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Sidebar({ open = false, onNavigate }) {
  return (
    <aside className={`ms-sidebar ${open ? "is-open" : ""}`.trim()}>
      <div className="ms-sidebar-brand">
        <BrandMark />
        <span className="name">MapaSeller</span>
        <span className="ver">v1.1</span>
      </div>

      <nav className="ms-sidebar-nav">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <div className="ms-sidebar-section">{group.label}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) => `ms-nav-item ${isActive ? "is-active" : ""}`.trim()}
              >
                <Icon name={item.icon} size={18} />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="ms-sidebar-foot">
        <div className="ms-sidebar-workspace">
          <div className="ms-avatar ms-avatar--sq ms-avatar--teal">FM</div>
          <div className="info">
            <div className="label">Workspace</div>
            <div className="name">FM Auto Peças</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
