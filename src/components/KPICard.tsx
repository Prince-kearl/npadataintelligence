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

// Glassmorphism variants: frosted white gradient cards with situational icon accents.
// Each variant maps to a semantic status color used only for the icon + subtle glass tint.
const VARIANT_STYLES: Record<
  KPIGradient,
  { iconBg: string; iconRing: string; iconColor: string; accent: string; glow: string }
> = {
  // Total Incidents → alert (destructive red)
  crimson: {
    iconBg: "bg-destructive/15",
    iconRing: "ring-destructive/25",
    iconColor: "text-destructive",
    accent: "text-destructive",
    glow: "bg-[radial-gradient(120%_80%_at_100%_0%,hsl(0_72%_51%/0.14),transparent_60%)]",
  },
  // Casualties → warning (amber)
  amber: {
    iconBg: "bg-warning/15",
    iconRing: "ring-warning/30",
    iconColor: "text-warning",
    accent: "text-warning",
    glow: "bg-[radial-gradient(120%_80%_at_100%_0%,hsl(40_82%_52%/0.16),transparent_60%)]",
  },
  // Resolved → success (green)
  teal: {
    iconBg: "bg-success/15",
    iconRing: "ring-success/30",
    iconColor: "text-success",
    accent: "text-success",
    glow: "bg-[radial-gradient(120%_80%_at_100%_0%,hsl(152_60%_38%/0.16),transparent_60%)]",
  },
  // Open Cases → info (blue)
  navy: {
    iconBg: "bg-info/15",
    iconRing: "ring-info/30",
    iconColor: "text-info",
    accent: "text-info",
    glow: "bg-[radial-gradient(120%_80%_at_100%_0%,hsl(210_90%_52%/0.14),transparent_60%)]",
  },
  // All-Time → primary brand navy
  gold: {
    iconBg: "bg-primary/15",
    iconRing: "ring-primary/25",
    iconColor: "text-primary",
    accent: "text-primary",
    glow: "bg-[radial-gradient(120%_80%_at_100%_0%,hsl(228_62%_26%/0.12),transparent_60%)]",
  },
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
  // ---- Glassmorphism variant ----
  if (gradient) {
    const v = VARIANT_STYLES[gradient];
    const changeTint =
      changeType === "positive"
        ? "text-success"
        : changeType === "negative"
          ? "text-destructive"
          : "text-muted-foreground";

    const content = (
      <div
        className={cn(
          "relative flex h-full flex-col justify-between overflow-hidden rounded-3xl p-5 transition-all",
          // Frosted white glass base
          "bg-[linear-gradient(135deg,rgba(255,255,255,0.85)_0%,rgba(255,255,255,0.55)_100%)]",
          "backdrop-blur-xl ring-1 ring-white/60 border border-white/40",
          "shadow-[0_10px_30px_-12px_rgba(15,23,42,0.18)]",
          to && "group-hover:shadow-[0_16px_40px_-14px_rgba(15,23,42,0.28)] group-hover:-translate-y-0.5",
        )}
      >
        {/* Situational color glow */}
        <div className={cn("pointer-events-none absolute inset-0", v.glow)} />
        {/* Extra top-left white gloss */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_0%_0%,rgba(255,255,255,0.7),transparent_55%)]" />

        {/* Header: icon + label inline */}
        <div className="relative flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full backdrop-blur-sm ring-1",
              v.iconBg,
              v.iconRing,
            )}
          >
            <Icon className={cn("h-5 w-5", v.iconColor)} />
          </div>
          <p className="text-sm font-semibold text-foreground/85 leading-tight">{title}</p>
        </div>

        {/* Footer: big value left, change right */}
        <div className="relative mt-6 flex items-end justify-between gap-3">
          <p className="text-4xl font-bold tracking-tight text-foreground leading-none">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {change && (
            <p className={cn("text-xs font-medium text-right leading-tight max-w-[55%]", changeTint)}>
              {change}
            </p>
          )}
        </div>

        {/* Action link */}
        {to && (
          <div
            className={cn(
              "relative mt-4 flex items-center justify-between border-t border-foreground/10 pt-3 text-xs font-semibold",
              v.accent,
            )}
          >
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
          className="group block rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
