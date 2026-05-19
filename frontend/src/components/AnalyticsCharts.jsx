import {
  Area,
  AreaChart,
  Bar,
  BarChart as ReBarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PremiumCard } from "./PremiumCard";

const COLORS = ["#F5F5F5", "#35D5E8", "#32D583", "#F5C542", "#FF4D5E", "#6F7683"];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      {label ? <strong>{label}</strong> : null}
      {payload.map((item) => (
        <span key={item.name || item.dataKey}>
          {item.name || item.dataKey}: {item.value}
        </span>
      ))}
    </div>
  );
}

export function ChartCard({ title, caption, children, className = "" }) {
  return (
    <PremiumCard className={`chart-card ${className}`.trim()}>
      <div className="chart-card-head">
        <div>
          <h3>{title}</h3>
          {caption ? <p>{caption}</p> : null}
        </div>
      </div>
      <div className="chart-body">{children}</div>
    </PremiumCard>
  );
}

export function DonutChart({ data = [] }) {
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);

  return (
    <div className="donut-layout">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={3}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-center">
        <span>Total</span>
        <strong>{total.toLocaleString("pt-BR")}</strong>
      </div>
      <div className="chart-legend">
        {data.map((item, index) => (
          <div key={item.name}>
            <i style={{ background: COLORS[index % COLORS.length] }} />
            <span>{item.name}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ColumnChart({ data = [], dataKey = "value" }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ReBarChart data={data} margin={{ top: 12, right: 4, left: -24, bottom: 0 }}>
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(53, 213, 232, 0.08)" }} />
        <Bar dataKey={dataKey} radius={[6, 6, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </ReBarChart>
    </ResponsiveContainer>
  );
}

export function Sparkline({ data = [] }) {
  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={data} margin={{ top: 12, right: 6, left: 6, bottom: 0 }}>
        <defs>
          <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#35D5E8" stopOpacity={0.34} />
            <stop offset="95%" stopColor="#35D5E8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Tooltip content={<ChartTooltip />} />
        <Area type="monotone" dataKey="value" stroke="#35D5E8" strokeWidth={2} fill="url(#sparkGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
