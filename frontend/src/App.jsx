import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, matchPath } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Icon } from "./components/ui/Icon";
import { AdCreatorPage } from "./pages/AdCreatorPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ImportPage } from "./pages/ImportPage";
import { MercadoLivreIntelligencePage } from "./pages/MercadoLivreIntelligencePage";
import { OpportunitiesPage } from "./pages/OpportunitiesPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { ProductsPage } from "./pages/ProductsPage";
import { SettingsPage } from "./pages/SettingsPage";

const ROUTE_META = [
  { pattern: "/", group: "Operação", current: "Dashboard" },
  { pattern: "/importar", group: "Operação", current: "Importar XLSX" },
  { pattern: "/produtos/:id", group: "Operação", current: "Detalhe do produto" },
  { pattern: "/produtos", group: "Operação", current: "Produtos" },
  { pattern: "/oportunidades", group: "Operação", current: "Oportunidades" },
  { pattern: "/marketplaces/mercadolivre", group: "Inteligência", current: "Inteligência ML" },
  { pattern: "/marketplaces", group: "Inteligência", current: "Marketplaces" },
  { pattern: "/anuncios", group: "Inteligência", current: "Central de Anúncios" },
  { pattern: "/configuracoes", group: "Sistema", current: "Configurações" },
];

function resolveMeta(pathname) {
  for (const meta of ROUTE_META) {
    if (matchPath({ path: meta.pattern, end: true }, pathname)) return meta;
  }
  return { group: "MapaSeller", current: "Visão geral" };
}

export default function App() {
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const meta = resolveMeta(location.pathname);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.classList.remove("theme-dark");
  }, []);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="ms-shell">
      <div className={`ms-sidebar-backdrop ${navOpen ? "is-open" : ""}`.trim()} onClick={() => setNavOpen(false)} />
      <Sidebar open={navOpen} onNavigate={() => setNavOpen(false)} />

      <div className="ms-main">
        <header className="ms-topbar">
          <button className="ms-topbar-icon-btn ms-burger" aria-label="Abrir menu" onClick={() => setNavOpen((v) => !v)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="ms-topbar-crumbs">
            <span>{meta.group}</span>
            <span className="sep">/</span>
            <span className="current">{meta.current}</span>
          </div>
          <div className="ms-topbar-actions">
            <div className="ms-search ms-topbar-search">
              <Icon name="search" size={16} />
              <input placeholder="Buscar SKU, produto, anúncio…" aria-label="Busca" />
              <span className="ms-kbd">⌘ K</span>
            </div>
            <button className="ms-topbar-icon-btn" aria-label="Notificações" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
              <span className="dot" />
            </button>
            <div className="ms-avatar ms-avatar--sm">FM</div>
          </div>
        </header>

        <main className="ms-content">
          <Routes location={location}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/importar" element={<ImportPage />} />
            <Route path="/produtos" element={<ProductsPage />} />
            <Route path="/produtos/:id" element={<ProductDetailPage />} />
            <Route path="/oportunidades" element={<OpportunitiesPage />} />
            <Route path="/marketplaces" element={<PlaceholderPage title="Marketplaces" description="Integrações de marketplaces prontas para evolução nas próximas etapas." />} />
            <Route path="/marketplaces/mercadolivre" element={<MercadoLivreIntelligencePage />} />
            <Route path="/anuncios" element={<AdCreatorPage />} />
            <Route path="/configuracoes" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
