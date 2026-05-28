import {
  Area,
  AreaChart,
  Bar,
  BarChart as ReBarChart,
  Cell,
  Line,
  LineChart as ReLineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["#2E2D8F", "#4747D9", "#A78BFA", "#3B82F6", "#14B8A6", "#C7BAFD"];
const AXIS_COLOR = "#9CA3AF";
const ACCENT = "#5B5BF0";

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
    <div className={`ms-card ${className}`.trim()}>
      <div className="ms-chart-card-head">
        <div>
          <h3>{title}</h3>
          {caption ? <p>{caption}</p> : null}
        </div>
      </div>
      <div>{children}</div>
    </div>
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
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: AXIS_COLOR, fontSize: 11 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: AXIS_COLOR, fontSize: 11 }} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(91, 91, 240, 0.06)" }} />
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
            <stop offset="5%" stopColor={ACCENT} stopOpacity={0.28} />
            <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Tooltip content={<ChartTooltip />} />
        <Area type="monotone" dataKey="value" stroke={ACCENT} strokeWidth={2} fill="url(#sparkGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TrendLineChart({ data = [], dataKey = "value" }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ReLineChart data={data} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: AXIS_COLOR, fontSize: 11 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: AXIS_COLOR, fontSize: 11 }} />
        <Tooltip content={<ChartTooltip />} />
        <Line type="monotone" dataKey={dataKey} stroke={ACCENT} strokeWidth={2.4} dot={{ r: 3, fill: "#fff", stroke: ACCENT }} />
      </ReLineChart>
    </ResponsiveContainer>
  );
}
