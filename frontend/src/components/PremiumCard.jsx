export function PremiumCard({ children, className = "" }) {
  return <section className={`premium-card ${className}`.trim()}>{children}</section>;
}
