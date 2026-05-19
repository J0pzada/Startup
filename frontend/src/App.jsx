import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ActionButton } from "./components/ActionButton";
import { ShaderBackground } from "./components/ShaderBackground";
import { Sidebar } from "./components/Sidebar";
import { ThemeToggle } from "./components/ThemeToggle";
import { PageShell } from "./components/PageShell";
import { AdCreatorPage } from "./pages/AdCreatorPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ImportPage } from "./pages/ImportPage";
import { MercadoLivreIntelligencePage } from "./pages/MercadoLivreIntelligencePage";
import { OpportunitiesPage } from "./pages/OpportunitiesPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { ProductsPage } from "./pages/ProductsPage";

const THEME_KEY = "mapaseller-theme";

function detectInitialTheme() {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return "dark";
}

export default function App() {
  const location = useLocation();
  const [theme, setTheme] = useState(detectInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("theme-dark", theme === "dark");
    root.setAttribute("data-theme", theme);
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const themeLabel = useMemo(() => (theme === "dark" ? "Escuro" : "Claro"), [theme]);

  return (
    <div className="app-shell">
      <ShaderBackground />
      <Sidebar />
      <div className="app-main">
        <header className="topbar glass-panel">
          <div>
            <p className="topbar-title">MapaSeller</p>
            <p className="topbar-subtitle">Marketplace Intelligence Console</p>
          </div>
          <div className="topbar-search" aria-label="Busca visual">
            <span>Search</span>
            <strong>Produto, SKU, status...</strong>
          </div>
          <div className="system-status">
            <i />
            API online
          </div>
          <ActionButton as={Link} to="/importar" variant="outline" size="sm" icon="+">
            Importar
          </ActionButton>
          <ThemeToggle theme={theme} onToggle={() => setTheme((current) => (current === "dark" ? "light" : "dark"))} label={themeLabel} />
        </header>

        <PageShell routeKey={location.pathname}>
          <Routes location={location}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/importar" element={<ImportPage />} />
            <Route path="/produtos" element={<ProductsPage />} />
            <Route path="/produtos/:id" element={<ProductDetailPage />} />
            <Route path="/oportunidades" element={<OpportunitiesPage />} />
            <Route path="/marketplaces" element={<PlaceholderPage title="Marketplaces" description="Integrações mockadas prontas para evolução nas próximas etapas." />} />
            <Route path="/marketplaces/mercadolivre" element={<MercadoLivreIntelligencePage />} />
            <Route path="/anuncios" element={<AdCreatorPage />} />
            <Route path="/configuracoes" element={<PlaceholderPage title="Configurações" description="Gerencie preferências do workspace e parâmetros operacionais do MapaSeller." />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </PageShell>
      </div>
    </div>
  );
}
