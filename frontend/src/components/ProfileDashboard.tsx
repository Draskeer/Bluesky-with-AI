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
      <span className="text-xs text-gray-300 w-8">{count}</span>
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
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 text-xs">
        Aucune donnee sur cette periode
      </div>
    );
  }

  const maxTotal = Math.max(
    ...data.map((d) => d.positive + d.neutral + d.negative),
    1
  );

  return (
    <div className="flex items-end gap-[3px] h-32">
      {data.map((point) => {
        const total = point.positive + point.neutral + point.negative;
        const hPct = (total / maxTotal) * 100;
        const pPos = total > 0 ? (point.positive / total) * 100 : 0;
        const pNeu = total > 0 ? (point.neutral / total) * 100 : 0;
        const pNeg = total > 0 ? (point.negative / total) * 100 : 0;

        return (
          <div
            key={point.period}
            className="flex-1 flex flex-col items-center gap-1 group relative"
          >
            {/* Tooltip */}
            <div className="absolute bottom-full mb-1 hidden group-hover:block z-10 pointer-events-none">
              <div className="bg-[#0a1627] border border-[#2f3e4e] rounded-lg px-2 py-1.5 text-[10px] text-gray-300 whitespace-nowrap shadow-lg">
                <div className="font-semibold text-white mb-0.5">
                  {formatPeriodLabel(point.period, range)}
                </div>
                <div className="text-green-400">
                  Positif: {point.positive}
                </div>
                <div className="text-gray-400">
                  Neutre: {point.neutral}
                </div>
                <div className="text-red-400">
                  Negatif: {point.negative}
                </div>
                {point.fake_count > 0 && (
                  <div className="text-orange-400 mt-0.5">
                    Fake: {point.fake_count}
                  </div>
                )}
              </div>
            </div>

            {/* Stacked bar */}
            <div
              className="w-full rounded-t-sm overflow-hidden flex flex-col-reverse cursor-pointer"
              style={{ height: `${hPct}%`, minHeight: total > 0 ? "4px" : "0" }}
            >
              {pNeg > 0 && (
                <div
                  className="w-full bg-red-500/80"
                  style={{ height: `${pNeg}%` }}
                />
              )}
              {pNeu > 0 && (
                <div
                  className="w-full bg-gray-500/60"
                  style={{ height: `${pNeu}%` }}
                />
              )}
              {pPos > 0 && (
                <div
                  className="w-full bg-green-500/80"
                  style={{ height: `${pPos}%` }}
                />
              )}
            </div>

            {/* X label — show only a few to avoid clutter */}
            {(data.length <= 12 ||
              data.indexOf(point) % Math.ceil(data.length / 7) === 0) && (
              <span className="text-[8px] text-gray-500 leading-none truncate w-full text-center">
                {formatPeriodLabel(point.period, range)}
              </span>
            )}
          </div>
        );
      })}
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
        <TrustGauge score={data.trustScore} />

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
