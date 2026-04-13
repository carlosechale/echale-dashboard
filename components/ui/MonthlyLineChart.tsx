// Pure SVG monthly line chart — Server Component, zero dependencies

export interface ChartMonth {
  label: string; // "Ene 25", "Feb 25", etc.
  leads: number;
  cerrados: number;
}

// Canvas dimensions
const W = 800;
const H = 220;
const PT = 16;
const PR = 16;
const PB = 36;
const PL = 16;
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

function buildPolyline(data: ChartMonth[], key: keyof Omit<ChartMonth, "label">, maxVal: number) {
  return data.map((d, i) => `${xPos(i, data.length)},${yPos(d[key], maxVal)}`).join(" ");
}

function buildArea(data: ChartMonth[], key: keyof Omit<ChartMonth, "label">, maxVal: number) {
  if (data.length < 2) return "";
  const baseline = PT + PLOT_H;
  const pts = data.map((d, i) => `${xPos(i, data.length)},${yPos(d[key], maxVal)}`).join(" L ");
  return `M ${xPos(0, data.length)},${baseline} L ${pts} L ${xPos(data.length - 1, data.length)},${baseline} Z`;
}

export default function MonthlyLineChart({ data }: { data: ChartMonth[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted text-sm font-sans">
        Sin datos para graficar
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => Math.max(d.leads, d.cerrados)), 1);
  const maxWithPad = maxVal * 1.15;
  const gridLines = 4;

  return (
    <div className="w-full">
      <div className="flex items-center gap-5 mb-4">
        <LegendItem color="#6B6B6B" label="Leads" />
        <LegendItem color="#C8FF00" label="Cerrados" />
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full overflow-visible"
        aria-label="Evolución mensual de leads y cerrados"
      >
        <defs>
          <linearGradient id="mlLeadsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6B6B6B" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#6B6B6B" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="mlCerradosFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C8FF00" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#C8FF00" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {Array.from({ length: gridLines }).map((_, i) => (
          <line
            key={i}
            x1={PL} y1={PT + (PLOT_H / gridLines) * i}
            x2={W - PR} y2={PT + (PLOT_H / gridLines) * i}
            stroke="#1F1F1F" strokeWidth="1"
          />
        ))}
        <line x1={PL} y1={PT + PLOT_H} x2={W - PR} y2={PT + PLOT_H} stroke="#1F1F1F" strokeWidth="1" />

        {/* Area fills */}
        {data.length >= 2 && (
          <>
            <path d={buildArea(data, "leads", maxWithPad)} fill="url(#mlLeadsFill)" />
            <path d={buildArea(data, "cerrados", maxWithPad)} fill="url(#mlCerradosFill)" />
          </>
        )}

        {/* Lines */}
        {data.length >= 2 && (
          <>
            <polyline
              points={buildPolyline(data, "leads", maxWithPad)}
              fill="none" stroke="#6B6B6B" strokeWidth="2"
              strokeLinejoin="round" strokeLinecap="round"
            />
            <polyline
              points={buildPolyline(data, "cerrados", maxWithPad)}
              fill="none" stroke="#C8FF00" strokeWidth="2"
              strokeLinejoin="round" strokeLinecap="round"
            />
          </>
        )}

        {/* Dots */}
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={xPos(i, data.length)} cy={yPos(d.leads, maxWithPad)}
              r="4" fill="#111111" stroke="#6B6B6B" strokeWidth="1.5" />
            <circle cx={xPos(i, data.length)} cy={yPos(d.cerrados, maxWithPad)}
              r="4" fill="#111111" stroke="#C8FF00" strokeWidth="1.5" />
          </g>
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={xPos(i, data.length)}
            y={H - 6}
            textAnchor="middle"
            fontSize="11"
            fill="#6B6B6B"
            fontFamily="DM Sans, sans-serif"
          >
            {d.label}
          </text>
        ))}
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
