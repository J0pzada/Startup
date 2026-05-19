import { PremiumCard } from "./PremiumCard";

export function EmptyState({ title, description }) {
  return (
    <PremiumCard className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
    </PremiumCard>
  );
}
