import { PremiumCard } from "../components/PremiumCard";
import { SectionHeader } from "../components/SectionHeader";

export function PlaceholderPage({ title, description }) {
  return (
    <div className="page-grid">
      <SectionHeader title={title} description={description} />
      <PremiumCard>
        <div className="placeholder-block">
          <h3>Módulo em evolução</h3>
          <p>
            Esta área já está preparada para expansão funcional sem alterar a base estável do MapaSeller.
          </p>
        </div>
      </PremiumCard>
    </div>
  );
}
