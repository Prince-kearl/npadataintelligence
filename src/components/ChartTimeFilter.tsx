import { useState } from "react";
import { CalendarRange, RotateCcw } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CHART_YEARS,
  DEFAULT_CHART_TIME_FILTER,
  MONTH_LABELS,
  QUARTER_MONTHS,
  type ChartTimeFilterState,
} from "@/lib/chart-time-filter";
import { cn } from "@/lib/utils";

/** Local-state hook: each card owns its own filter. */
export function useChartTimeFilter(initial: Partial<ChartTimeFilterState> = {}) {
  const [state, setState] = useState<ChartTimeFilterState>({
    ...DEFAULT_CHART_TIME_FILTER,
    ...initial,
  });
  return [state, setState] as const;
}

interface Props {
  value: ChartTimeFilterState;
  onChange: (next: ChartTimeFilterState) => void;
  className?: string;
  compact?: boolean;
}

export function ChartTimeFilter({ value, onChange, className, compact }: Props) {
  const setYear = (year: number | null) =>
    onChange({ year, quarter: null, month: null });
  const setQuarter = (q: 1 | 2 | 3 | 4 | null) =>
    onChange({ ...value, quarter: q, month: null });
  const setMonth = (m: number | null) => onChange({ ...value, month: m });
  const reset = () => onChange(DEFAULT_CHART_TIME_FILTER);

  const isDefault =
    value.year === null && value.quarter === null && value.month === null;
  const quarterMonths = value.quarter ? QUARTER_MONTHS[value.quarter] : [];

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 text-xs",
        className,
      )}
    >
      <CalendarRange className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

      <Select
        value={value.year ? String(value.year) : "all"}
        onValueChange={(v) => setYear(v === "all" ? null : Number(v))}
      >
        <SelectTrigger
          className={cn(
            "h-7 min-w-[86px] bg-card border-border text-xs px-2",
            compact && "h-6",
          )}
        >
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All years</SelectItem>
          {CHART_YEARS.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value.year !== null && (
        <div className="flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5">
          {([1, 2, 3, 4] as const).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setQuarter(value.quarter === q ? null : q)}
              className={cn(
                "px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors",
                value.quarter === q
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
              aria-pressed={value.quarter === q}
            >
              Q{q}
            </button>
          ))}
        </div>
      )}

      {value.quarter !== null && (
        <Select
          value={value.month ? String(value.month) : "all"}
          onValueChange={(v) => setMonth(v === "all" ? null : Number(v))}
        >
          <SelectTrigger
            className={cn(
              "h-7 min-w-[80px] bg-card border-border text-xs px-2",
              compact && "h-6",
            )}
          >
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All months</SelectItem>
            {quarterMonths.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {MONTH_LABELS[m - 1]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {!isDefault && (
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Reset time filter"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      )}
    </div>
  );
}

/** Skeleton shimmer for a chart card while a filter change is resolving. */
export function ChartLoadingSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div
      className="w-full rounded-md bg-gradient-to-r from-muted/40 via-muted/80 to-muted/40 bg-[length:200%_100%] animate-shimmer"
      style={{ height }}
      aria-busy="true"
      aria-label="Loading chart"
    />

  );
}
