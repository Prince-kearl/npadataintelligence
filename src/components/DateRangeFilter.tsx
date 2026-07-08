import { CalendarRange } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DATE_RANGE_LABELS, type DateRangeMode } from "@/lib/date-filter";

interface Props {
  value: DateRangeMode;
  onChange: (value: DateRangeMode) => void;
  className?: string;
}

/**
 * Unified date-range control used across analytical dashboards.
 * Changing this value re-filters every downstream chart in one go.
 */
export function DateRangeFilter({ value, onChange, className }: Props) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <CalendarRange className="h-4 w-4 text-muted-foreground" />
      <Select value={value} onValueChange={(v) => onChange(v as DateRangeMode)}>
        <SelectTrigger className="h-9 w-[160px] bg-card border-border text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="monthly">{DATE_RANGE_LABELS.monthly}</SelectItem>
          <SelectItem value="quarterly">{DATE_RANGE_LABELS.quarterly}</SelectItem>
          <SelectItem value="yearly">{DATE_RANGE_LABELS.yearly}</SelectItem>
          <SelectItem value="all">{DATE_RANGE_LABELS.all}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
