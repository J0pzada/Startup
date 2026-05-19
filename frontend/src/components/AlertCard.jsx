import { Badge } from "./Badge";
import { PremiumCard } from "./PremiumCard";

export function AlertCard({ title, description, tone = "warning", badge = "Alerta" }) {
  return (
    <PremiumCard className="alert-card">
      <div className="alert-card-head">
        <h4>{title}</h4>
        <Badge tone={tone}>{badge}</Badge>
      </div>
      <p>{description}</p>
    </PremiumCard>
  );
}
