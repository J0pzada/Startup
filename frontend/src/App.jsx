import { Navigate, Route, Routes } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { DashboardPage } from "./pages/DashboardPage";
import { ImportPage } from "./pages/ImportPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { ProductsPage } from "./pages/ProductsPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";

export default function App() {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1 p-6">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/importar" element={<ImportPage />} />
          <Route path="/produtos" element={<ProductsPage />} />
          <Route path="/produtos/:id" element={<ProductDetailPage />} />
          <Route path="/oportunidades" element={<PlaceholderPage title="Oportunidades" />} />
          <Route path="/marketplaces" element={<PlaceholderPage title="Marketplaces" />} />
          <Route path="/anuncios" element={<PlaceholderPage title="Criador de Anúncios" />} />
          <Route path="/configuracoes" element={<PlaceholderPage title="Configurações" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
