import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  iconColor?: string;
}

export function KPICard({ title, value, icon: Icon, change, changeType = "neutral", iconColor }: KPICardProps) {
  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <span className="dash-card-title">{title}</span>
        <span className="dash-card-period">last month ▾</span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="kpi-value">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {change && (
            <p className={cn(
              "text-xs mt-1.5 font-medium",
              changeType === "positive" && "kpi-change-positive",
              changeType === "negative" && "kpi-change-negative",
              changeType === "neutral" && "text-muted-foreground"
            )}>
              {change}
            </p>
          )}
        </div>
        <div className={cn(
          "h-10 w-10 rounded-xl flex items-center justify-center",
          iconColor || "bg-primary/15"
        )}>
          <Icon className={cn("h-5 w-5", iconColor ? "text-foreground" : "text-primary")} />
        </div>
      </div>
    </div>
  );
}
