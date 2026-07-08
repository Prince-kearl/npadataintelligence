import type { EnhancedTrendPoint } from "@/lib/chart-time-filter";

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: EnhancedTrendPoint }>;
  label?: string;
}

/**
 * Custom tooltip for the Consumer Incident Trend chart.
 * Shows total incidents, % change vs previous bucket, and the top incident
 * category for the bucket.
 */
export function ConsumerTrendTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const pct = point.pctChange;
  const pctColor =
    pct === null ? "hsl(220, 15%, 50%)" : pct > 0 ? "hsl(0, 72%, 51%)" : pct < 0 ? "hsl(152, 60%, 38%)" : "hsl(220, 15%, 50%)";
  const pctText =
    pct === null ? "—" : `${pct > 0 ? "▲" : pct < 0 ? "▼" : ""} ${Math.abs(pct).toFixed(1)}%`;

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid hsl(220, 16%, 90%)",
        borderRadius: 8,
        padding: "10px 12px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        fontSize: 12,
        minWidth: 180,
      }}
    >
      <div style={{ fontWeight: 600, color: "hsl(228, 62%, 26%)", marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <span style={{ color: "hsl(220, 15%, 40%)" }}>Consumer incidents</span>
        <span style={{ fontWeight: 600 }}>{point.incidents}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 3 }}>
        <span style={{ color: "hsl(220, 15%, 40%)" }}>vs previous</span>
        <span style={{ fontWeight: 600, color: pctColor }}>{pctText}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 3 }}>
        <span style={{ color: "hsl(220, 15%, 40%)" }}>Top category</span>
        <span style={{ fontWeight: 600, textAlign: "right" }}>
          {point.topCategory ? `${point.topCategory} (${point.topCategoryCount})` : "—"}
        </span>
      </div>
    </div>
  );
}
