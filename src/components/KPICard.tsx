import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  iconBg?: string;
  iconClass?: string;
}

export function KPICard({ title, value, icon: Icon, change, changeType = "neutral", iconBg, iconClass }: KPICardProps) {
  return (
    <div className="dash-card">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="dash-card-title">{title}</p>
          <p className="kpi-value">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {change && (
            <p className={cn(
              "text-xs font-medium",
              changeType === "positive" && "kpi-change-positive",
              changeType === "negative" && "kpi-change-negative",
              changeType === "neutral" && "text-muted-foreground"
            )}>
              {change}
            </p>
          )}
        </div>
        <div className={cn(
          "h-11 w-11 rounded-xl flex items-center justify-center shrink-0",
          iconBg || "bg-accent/10"
        )}>
          <Icon className={cn("h-5 w-5", iconClass || "text-accent")} />
        </div>
      </div>
    </div>
  );
}
