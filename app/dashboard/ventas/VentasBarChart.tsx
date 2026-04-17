// Pure SVG bar chart — Server Component, zero dependencies

interface Props {
  paid: number;
  organico: number;
  outbound: number;
}

const W = 600;
const H = 220;
const PT = 30;
const PB = 40;
const PL = 20;
const PR = 20;
const PLOT_H = H - PT - PB;
const PLOT_W = W - PL - PR;
const BAR_W = 80;

const CHANNELS = [
  { key: "paid",      label: "Paid Media", color: "#C8FF00" },
  { key: "organico",  label: "Orgánico",   color: "#6B6B6B" },
  { key: "outbound",  label: "Outbound",   color: "#F5F5F5" },
] as const;

const POSITIONS = [
  PL + PLOT_W * 0.2,
  PL + PLOT_W * 0.5,
  PL + PLOT_W * 0.8,
];

export default function VentasBarChart({ paid, organico, outbound }: Props) {
  const values = [paid, organico, outbound];
  const maxVal = Math.max(...values, 1);
  const maxWithPad = maxVal * 1.25;

  if (paid === 0 && organico === 0 && outbound === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted text-sm font-sans">
        Sin datos para el mes actual
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full"
      aria-label="Leads por canal"
    >
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const y = PT + PLOT_H * (1 - t);
        return <line key={i} x1={PL} y1={y} x2={W - PR} y2={y} stroke="#1F1F1F" strokeWidth="1" />;
      })}

      {/* Bars */}
      {values.map((val, i) => {
        const barH = Math.max((val / maxWithPad) * PLOT_H, val > 0 ? 4 : 0);
        const x = POSITIONS[i] - BAR_W / 2;
        const y = PT + PLOT_H - barH;
        const { label, color } = CHANNELS[i];

        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={BAR_W}
              height={barH}
              rx="4"
              fill={color}
              fillOpacity={val === 0 ? 0.15 : 0.85}
            />
            {val > 0 && (
              <text
                x={POSITIONS[i]}
                y={y - 8}
                textAnchor="middle"
                fontSize="15"
                fontWeight="700"
                fill={color}
                fontFamily="Syne, sans-serif"
              >
                {val}
              </text>
            )}
            <text
              x={POSITIONS[i]}
              y={H - 8}
              textAnchor="middle"
              fontSize="12"
              fill="#6B6B6B"
              fontFamily="DM Sans, sans-serif"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
