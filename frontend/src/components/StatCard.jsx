import { AnimatedNumber } from "./AnimatedNumber";
import { Badge } from "./Badge";
import { PremiumCard } from "./PremiumCard";

export function StatCard({ title, value, hint, tone = "default", formatter = (n) => Math.round(n).toLocaleString("pt-BR") }) {
  return (
    <PremiumCard className={`stat-card stat-card-${tone}`}>
      <div className="stat-card-head">
        <p>{title}</p>
        {hint ? <Badge tone={tone}>{hint}</Badge> : null}
      </div>
      <div className="stat-card-value">
        <AnimatedNumber value={Number(value) || 0} formatter={formatter} />
      </div>
      <div className="stat-card-meter" aria-hidden="true">
        <span style={{ width: `${Math.max(8, Math.min(100, Number(value) || 0))}%` }} />
      </div>
    </PremiumCard>
  );
}
