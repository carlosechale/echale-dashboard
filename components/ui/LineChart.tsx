// Pure SVG line chart — Server Component, zero dependencies

export interface ChartDay {
  day: number;
  leads: number;
  cerrados: number;
}

interface Props {
  data: ChartDay[];
}

// Canvas dimensions
const W = 800;
const H = 200;
const PT = 16;   // padding top
const PR = 12;   // padding right
const PB = 32;   // padding bottom (x-axis labels)
const PL = 12;   // padding left
const PLOT_W = W - PL - PR;
const PLOT_H = H - PT - PB;

function xPos(i: number, total: number): number {
  if (total <= 1) return PL + PLOT_W / 2;
  return PL + (i / (total - 1)) * PLOT_W;
}

function yPos(value: number, maxVal: number): number {
  if (!maxVal) return PT + PLOT_H;
  return PT + PLOT_H - (value / maxVal) * PLOT_H;
}

function buildPolyline(data: ChartDay[], key: "leads" | "cerrados", maxVal: number): string {
  return data.map((d, i) => `${xPos(i, data.length)},${yPos(d[key], maxVal)}`).join(" ");
}

function buildAreaPath(data: ChartDay[], key: "leads" | "cerrados", maxVal: number): string {
  if (data.length < 2) return "";
  const baseline = PT + PLOT_H;
  const points = data.map((d, i) => `${xPos(i, data.length)},${yPos(d[key], maxVal)}`).join(" L ");
  const first = `${xPos(0, data.length)},${baseline}`;
  const last  = `${xPos(data.length - 1, data.length)},${baseline}`;
  return `M ${first} L ${points} L ${last} Z`;
}

// Show x-axis labels every N days to avoid clutter
function xLabels(data: ChartDay[]): ChartDay[] {
  if (data.length <= 7) return data;
  const step = Math.ceil(data.length / 7);
  return data.filter((_, i) => i % step === 0 || i === data.length - 1);
}

export default function LineChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted text-sm font-sans">
        Sin datos para graficar
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => Math.max(d.leads, d.cerrados)), 1);
  // Add ~15% headroom so points don't touch the top edge
  const maxWithPad = maxVal * 1.15;

  const gridLines = 4;

  return (
    <div className="w-full">
      {/* Legend */}
      <div className="flex items-center gap-5 mb-4">
        <LegendItem color="#6B6B6B" label="Leads" />
        <LegendItem color="#C8FF00" label="Cerrados" />
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full overflow-visible"
        aria-label="Gráfico de leads y cerrados"
      >
        {/* Defs: gradient fills */}
        <defs>
          <linearGradient id="leadsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6B6B6B" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#6B6B6B" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="cerradosFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C8FF00" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#C8FF00" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {Array.from({ length: gridLines }).map((_, i) => {
          const y = PT + (PLOT_H / gridLines) * i;
          return (
            <line
              key={i}
              x1={PL}
              y1={y}
              x2={W - PR}
              y2={y}
              stroke="#1F1F1F"
              strokeWidth="1"
            />
          );
        })}
        {/* Baseline */}
        <line x1={PL} y1={PT + PLOT_H} x2={W - PR} y2={PT + PLOT_H} stroke="#1F1F1F" strokeWidth="1" />

        {/* Area fills */}
        {data.length >= 2 && (
          <>
            <path d={buildAreaPath(data, "leads", maxWithPad)} fill="url(#leadsFill)" />
            <path d={buildAreaPath(data, "cerrados", maxWithPad)} fill="url(#cerradosFill)" />
          </>
        )}

        {/* Lines */}
        {data.length >= 2 && (
          <>
            <polyline
              points={buildPolyline(data, "leads", maxWithPad)}
              fill="none"
              stroke="#6B6B6B"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <polyline
              points={buildPolyline(data, "cerrados", maxWithPad)}
              fill="none"
              stroke="#C8FF00"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        )}

        {/* Dots */}
        {data.map((d, i) => {
          const x = xPos(i, data.length);
          return (
            <g key={i}>
              {/* Leads dot */}
              <circle cx={x} cy={yPos(d.leads, maxWithPad)} r="3.5" fill="#111111" stroke="#6B6B6B" strokeWidth="1.5" />
              {/* Cerrados dot */}
              <circle cx={x} cy={yPos(d.cerrados, maxWithPad)} r="3.5" fill="#111111" stroke="#C8FF00" strokeWidth="1.5" />
            </g>
          );
        })}

        {/* X-axis labels */}
        {xLabels(data).map((d, i) => {
          const idx = data.indexOf(d);
          return (
            <text
              key={i}
              x={xPos(idx, data.length)}
              y={H - 4}
              textAnchor="middle"
              fontSize="11"
              fill="#6B6B6B"
              fontFamily="DM Sans, sans-serif"
            >
              {d.day}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: color }} />
      <span className="text-xs font-sans text-muted">{label}</span>
    </div>
  );
}
