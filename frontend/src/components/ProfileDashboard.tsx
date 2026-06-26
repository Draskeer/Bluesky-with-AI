import { useEffect, useState } from "react";
import { api } from "../services/api";

interface TimelinePoint {
  period: string;
  positive: number;
  neutral: number;
  negative: number;
  fake_count: number;
  real_count: number;
  avg_confidence: number;
}

interface DashboardData {
  trustScore: number;
  messageCount: number;
  sentimentSummary: { positive: number; neutral: number; negative: number };
  fakeRate: number;
  avgConfidence: number;
  timeline: TimelinePoint[];
}

type Range = "week" | "month" | "year";

const RANGE_LABELS: Record<Range, string> = {
  week: "Semaine",
  month: "Mois",
  year: "Année",
};

function formatPeriodLabel(iso: string, range: Range): string {
  const d = new Date(iso);
  if (range === "year") {
    return d.toLocaleDateString("fr-FR", { month: "short" });
  }
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function TrustGauge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const filled = (pct / 100) * circumference;

  const color =
    pct >= 80
      ? "#22c55e"
      : pct >= 60
        ? "#84cc16"
        : pct >= 40
          ? "#eab308"
          : pct >= 20
            ? "#f97316"
            : "#ef4444";

  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#2f3e4e"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={`${filled} ${circumference - filled}`}
          strokeDashoffset={circumference * 0.25}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
        <text
          x="50"
          y="46"
          textAnchor="middle"
          className="fill-white text-xl font-bold"
          style={{ fontSize: "22px" }}
        >
          {pct}%
        </text>
        <text
          x="50"
          y="62"
          textAnchor="middle"
          className="fill-gray-400"
          style={{ fontSize: "9px" }}
        >
          Trust Score
        </text>
      </svg>
    </div>
  );
}

function SentimentBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-16 text-right">{label}</span>
      <div className="flex-1 h-3 bg-[#2f3e4e] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-gray-300 w-10 text-right">{pct.toFixed(1)}%</span>
    </div>
  );
}

function TimelineChart({
  data,
  range,
}: {
  data: TimelinePoint[];
  range: Range;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 text-xs">
        Aucune donnée sur cette période
      </div>
    );
  }

  const W = 320;
  const H = 110;
  const PAD = { top: 8, right: 8, bottom: 20, left: 20 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(
    ...data.flatMap((d) => [d.positive, d.neutral, d.negative]),
    1
  );

  const getX = (i: number) =>
    PAD.left + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW);
  const getY = (val: number) =>
    PAD.top + chartH - (val / maxVal) * chartH;

  // Smooth bezier path (monotone cubic)
  const buildPath = (values: number[]): string => {
    if (values.length === 0) return "";
    if (values.length === 1) return `M ${getX(0)} ${getY(values[0])}`;
    const pts = values.map((v, i) => [getX(i), getY(v)] as [number, number]);
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const cpx = (x0 + x1) / 2;
      d += ` C ${cpx} ${y0} ${cpx} ${y1} ${x1} ${y1}`;
    }
    return d;
  };

  const posPath = buildPath(data.map((d) => d.positive));
  const neuPath = buildPath(data.map((d) => d.neutral));
  const negPath = buildPath(data.map((d) => d.negative));

  // Which x-axis labels to show
  const step = data.length <= 7 ? 1 : Math.ceil(data.length / 6);
  const showLabel = (i: number) =>
    i % step === 0 || i === data.length - 1;

  const hovered = hoveredIdx !== null ? data[hoveredIdx] : null;

  // Tooltip x clamped so it doesn't overflow
  const tooltipX = hoveredIdx !== null
    ? Math.max(10, Math.min(getX(hoveredIdx), W - 80))
    : 0;

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: "128px" }}
      >
        {/* Horizontal grid lines */}
        {[0, 0.5, 1].map((pct) => (
          <line
            key={pct}
            x1={PAD.left}
            y1={PAD.top + chartH * (1 - pct)}
            x2={W - PAD.right}
            y2={PAD.top + chartH * (1 - pct)}
            stroke="#2f3e4e"
            strokeWidth="0.5"
          />
        ))}

        {/* Sentiment curves */}
        <path d={posPath} fill="none" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" />
        <path d={neuPath} fill="none" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" />
        <path d={negPath} fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" />

        {/* Dots */}
        {data.map((point, i) => (
          <g key={point.period}>
            <circle cx={getX(i)} cy={getY(point.positive)} r="2.5" fill="#22c55e" />
            <circle cx={getX(i)} cy={getY(point.neutral)} r="2.5" fill="#6b7280" />
            <circle cx={getX(i)} cy={getY(point.negative)} r="2.5" fill="#ef4444" />
          </g>
        ))}

        {/* Hover vertical line */}
        {hoveredIdx !== null && (
          <line
            x1={getX(hoveredIdx)}
            y1={PAD.top}
            x2={getX(hoveredIdx)}
            y2={PAD.top + chartH}
            stroke="#4b6070"
            strokeWidth="1"
            strokeDasharray="3 2"
          />
        )}

        {/* Invisible hover zones */}
        {data.map((_, i) => {
          const x = getX(i);
          const zoneW = data.length === 1 ? chartW : chartW / (data.length - 1);
          return (
            <rect
              key={i}
              x={x - zoneW / 2}
              y={PAD.top}
              width={zoneW}
              height={chartH}
              fill="transparent"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: "crosshair" }}
            />
          );
        })}

        {/* X-axis labels */}
        {data.map((point, i) =>
          showLabel(i) ? (
            <text
              key={point.period}
              x={getX(i)}
              y={H - 3}
              textAnchor="middle"
              fill="#6b7280"
              fontSize="7"
            >
              {formatPeriodLabel(point.period, range)}
            </text>
          ) : null
        )}
      </svg>

      {/* HTML tooltip */}
      {hovered && hoveredIdx !== null && (
        <div
          className="absolute top-0 pointer-events-none z-10"
          style={{ left: `${(tooltipX / W) * 100}%` }}
        >
          <div className="bg-[#0a1627] border border-[#2f3e4e] rounded-lg px-2 py-1.5 text-[10px] text-gray-300 whitespace-nowrap shadow-lg">
            <div className="font-semibold text-white mb-0.5">
              {formatPeriodLabel(hovered.period, range)}
            </div>
            <div className="text-green-400">Positif : {hovered.positive}</div>
            <div className="text-gray-400">Neutre : {hovered.neutral}</div>
            <div className="text-red-400">Négatif : {hovered.negative}</div>
            {hovered.fake_count > 0 && (
              <div className="text-orange-400 mt-0.5">Fake : {hovered.fake_count}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfileDashboard({
  did,
  handle,
}: {
  did: string;
  handle: string;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("month");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    api.dashboard.get(did, handle, range).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) {
        setData(res.data);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [did, handle, range]);

  if (loading) {
    return (
      <div className="bg-[#1c2938] rounded-2xl p-4 border border-[#2f3e4e]">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#0085ff]" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-[#1c2938] rounded-2xl p-4 border border-[#2f3e4e]">
        <p className="text-gray-500 text-sm text-center py-4">
          Dashboard indisponible
        </p>
      </div>
    );
  }

  const totalSentiment =
    data.sentimentSummary.positive +
    data.sentimentSummary.neutral +
    data.sentimentSummary.negative;

  // Trust score calculé côté client depuis les vraies stats de la période.
  // On ignore data.trustScore (peut être 0.5 si users.trust_rate n'est pas à jour).
  const periodTrustScore =
    data.messageCount > 0
      ? (1 - data.fakeRate) * data.avgConfidence
      : 0.5;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-[#1c2938] rounded-2xl p-4 border border-[#2f3e4e]">
        <h2 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
          <svg
            className="w-4 h-4 text-[#0085ff]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          Dashboard IA
        </h2>

        {/* Trust Score Gauge */}
        <TrustGauge score={periodTrustScore} />

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="bg-[#0f1a2a] rounded-lg p-2 text-center">
            <div className="text-white font-bold text-sm">
              {data.messageCount}
            </div>
            <div className="text-gray-500 text-[10px]">Analyses</div>
          </div>
          <div className="bg-[#0f1a2a] rounded-lg p-2 text-center">
            <div
              className={`font-bold text-sm ${
                data.fakeRate > 0.3
                  ? "text-red-400"
                  : data.fakeRate > 0.1
                    ? "text-yellow-400"
                    : "text-green-400"
              }`}
            >
              {Math.round(data.fakeRate * 100)}%
            </div>
            <div className="text-gray-500 text-[10px]">Taux fake</div>
          </div>
          <div className="bg-[#0f1a2a] rounded-lg p-2 text-center">
            <div className="text-[#0085ff] font-bold text-sm">
              {Math.round(data.avgConfidence * 100)}%
            </div>
            <div className="text-gray-500 text-[10px]">Confiance</div>
          </div>
        </div>
      </div>

      {/* Sentiment Distribution */}
      <div className="bg-[#1c2938] rounded-2xl p-4 border border-[#2f3e4e]">
        <h3 className="text-white font-bold text-xs mb-3">
          Repartition du sentiment
        </h3>
        <div className="space-y-2">
          <SentimentBar
            label="Positif"
            count={data.sentimentSummary.positive}
            total={totalSentiment}
            color="#22c55e"
          />
          <SentimentBar
            label="Neutre"
            count={data.sentimentSummary.neutral}
            total={totalSentiment}
            color="#6b7280"
          />
          <SentimentBar
            label="Negatif"
            count={data.sentimentSummary.negative}
            total={totalSentiment}
            color="#ef4444"
          />
        </div>
      </div>

      {/* Sentiment Timeline */}
      <div className="bg-[#1c2938] rounded-2xl p-4 border border-[#2f3e4e]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold text-xs">Sentiment dans le temps</h3>
        </div>

        {/* Range Selector */}
        <div className="flex bg-[#0f1a2a] rounded-lg p-0.5 mb-3">
          {(["week", "month", "year"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`flex-1 text-[11px] font-medium py-1.5 rounded-md transition-all ${
                range === r
                  ? "bg-[#0085ff] text-white shadow"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>

        {/* Chart */}
        <TimelineChart data={data.timeline} range={range} />

        {/* Legend */}
        <div className="flex items-center justify-center gap-3 mt-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-[9px] text-gray-400">Positif</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-gray-500" />
            <span className="text-[9px] text-gray-400">Neutre</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[9px] text-gray-400">Negatif</span>
          </div>
        </div>
      </div>
    </div>
  );
}
