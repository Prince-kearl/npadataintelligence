import { useEffect, useRef, useState } from "react";
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

/**
 * Briefly toggles a `loading` flag whenever the filter state changes so the
 * card can show a shimmer skeleton while the query re-computes. Local to each
 * card — no global reload.
 */
export function useChartFilterLoading(state: ChartTimeFilterState, delay = 320) {
  const [loading, setLoading] = useState(false);
  const first = useRef(true);
  const key = `${state.year}-${state.quarter}-${state.month}`;
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setLoading(true);
    const t = setTimeout(() => setLoading(false), delay);
    return () => clearTimeout(t);
  }, [key, delay]);
  return loading;
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
        // Single unified pill: icon + controls stay on one line together.
        "inline-flex items-center flex-nowrap rounded-full border border-border bg-card shadow-sm text-xs overflow-hidden shrink-0",
        compact ? "h-8" : "h-9",
        className,
      )}
      role="group"
      aria-label="Time filter"
    >
      {/* Leading calendar segment */}
      <div className="flex items-center justify-center h-full px-2.5 bg-muted/40 border-r border-border text-muted-foreground">
        <CalendarRange className="h-3.5 w-3.5" />
      </div>

      {/* Year select */}
      <Select
        value={value.year ? String(value.year) : "all"}
        onValueChange={(v) => setYear(v === "all" ? null : Number(v))}
      >
        <SelectTrigger
          className={cn(
            "h-full min-w-[92px] border-0 bg-transparent rounded-none px-2.5 text-xs font-medium focus:ring-0 focus:ring-offset-0 shadow-none gap-1",
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

      {/* Quarter buttons */}
      {value.year !== null && (
        <div className="flex items-center h-full border-l border-border pl-1 pr-1 gap-0.5">
          {([1, 2, 3, 4] as const).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setQuarter(value.quarter === q ? null : q)}
              className={cn(
                "px-1.5 h-6 text-[10px] font-semibold rounded transition-colors",
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

      {/* Month select */}
      {value.quarter !== null && (
        <Select
          value={value.month ? String(value.month) : "all"}
          onValueChange={(v) => setMonth(v === "all" ? null : Number(v))}
        >
          <SelectTrigger
            className={cn(
              "h-full min-w-[86px] border-0 border-l border-border bg-transparent rounded-none px-2.5 text-xs font-medium focus:ring-0 focus:ring-offset-0 shadow-none gap-1",
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

      {/* Reset */}
      {!isDefault && (
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center h-full px-2 border-l border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Reset time filter"
          title="Reset"
        >
          <RotateCcw className="h-3.5 w-3.5" />
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
