const toneMap = {
  default: "badge-default",
  accent: "badge-accent",
  success: "badge-success",
  warning: "badge-warning",
  danger: "badge-danger",
  muted: "badge-muted",
};

export function Badge({ children, tone = "default" }) {
  return (
    <span className={`badge ${toneMap[tone] || toneMap.default}`}>
      <i aria-hidden="true" />
      {children}
    </span>
  );
}
