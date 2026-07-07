import { cn } from "@/lib/utils";
import { LucideIcon, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface KPICardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  iconBg?: string;
  iconClass?: string;
  to?: string;
  ctaLabel?: string;
}

export function KPICard({ title, value, icon: Icon, change, changeType = "neutral", iconBg, iconClass, to, ctaLabel }: KPICardProps) {
  const inner = (
    <>
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
      {to && (
        <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-xs font-medium text-primary group-hover:text-primary/80">
          <span>{ctaLabel ?? "View details"}</span>
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </div>
      )}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="dash-card group block transition-all hover:shadow-md hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {inner}
      </Link>
    );
  }
  return <div className="dash-card">{inner}</div>;
}
