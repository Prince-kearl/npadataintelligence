import { cn } from "@/lib/utils";
import { LucideIcon, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export type KPIGradient = "crimson" | "amber" | "teal" | "navy" | "gold";

interface KPICardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  /** Optional gradient variant. When set, the card renders in the rich brand style. */
  gradient?: KPIGradient;
  /** Legacy props (ignored when gradient is used). */
  iconBg?: string;
  iconClass?: string;
  to?: string;
  ctaLabel?: string;
}

const GRADIENT_STYLES: Record<KPIGradient, string> = {
  // Card 1 – Total Incidents: Crimson → Dark Red
  crimson: "bg-[linear-gradient(135deg,hsl(0,78%,55%)_0%,hsl(0,72%,38%)_100%)]",
  // Card 2 – Casualties: Amber Gold → Deep Orange
  amber: "bg-[linear-gradient(135deg,hsl(40,90%,55%)_0%,hsl(20,90%,45%)_100%)]",
  // Card 3 – Resolved: Vibrant Teal → Emerald
  teal: "bg-[linear-gradient(135deg,hsl(180,65%,42%)_0%,hsl(152,68%,36%)_100%)]",
  // Card 4 – Open Cases: Deep Navy → Electric Blue
  navy: "bg-[linear-gradient(135deg,hsl(228,62%,26%)_0%,hsl(210,90%,52%)_100%)]",
  // Card 5 – All-Time: Gold → Bronze (brand accent)
  gold: "bg-[linear-gradient(135deg,hsl(40,82%,52%)_0%,hsl(28,70%,38%)_100%)]",
};

export function KPICard({
  title,
  value,
  icon: Icon,
  change,
  changeType = "neutral",
  gradient,
  iconBg,
  iconClass,
  to,
  ctaLabel,
}: KPICardProps) {
  // ---- Gradient variant (new design) ----
  if (gradient) {
    const changeTint =
      changeType === "positive"
        ? "text-white"
        : changeType === "negative"
          ? "text-white"
          : "text-white/85";

    const content = (
      <div
        className={cn(
          "relative flex h-full flex-col justify-between overflow-hidden rounded-3xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(15,23,42,0.35)] transition-all",
          GRADIENT_STYLES[gradient],
          to && "group-hover:shadow-[0_16px_40px_-14px_rgba(15,23,42,0.5)] group-hover:-translate-y-0.5",
        )}
      >
        {/* Decorative gloss */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_100%_0%,rgba(255,255,255,0.28),transparent_55%)]" />

        {/* Header: icon + label inline */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
            <Icon className="h-5 w-5 text-white" />
          </div>
          <p className="text-sm font-medium text-white/90 leading-tight">{title}</p>
        </div>

        {/* Footer: big value left, change right */}
        <div className="relative mt-6 flex items-end justify-between gap-3">
          <p className="text-4xl font-bold tracking-tight text-white leading-none">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {change && (
            <p className={cn("text-xs font-medium text-right leading-tight max-w-[55%]", changeTint)}>
              {change}
            </p>
          )}
        </div>

        {/* Action link overlay */}
        {to && (
          <div className="relative mt-4 flex items-center justify-between border-t border-white/20 pt-3 text-xs font-semibold text-white/95">
            <span>{ctaLabel ?? "View details"}</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        )}
      </div>
    );

    if (to) {
      return (
        <Link
          to={to}
          className="group block rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {content}
        </Link>
      );
    }
    return <div className="group">{content}</div>;
  }

  // ---- Legacy variant (unchanged, for other pages still using it) ----
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
