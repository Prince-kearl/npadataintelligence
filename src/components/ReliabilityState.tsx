import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function LoadingState({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-8", className)} role="status" aria-live="polite">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

export function PageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-5", className)} role="status" aria-live="polite" aria-label="Loading content">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-72 max-w-[75vw]" />
          <Skeleton className="h-4 w-56 max-w-[65vw]" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-7 w-16" />
            <Skeleton className="mt-3 h-3 w-28" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="mt-4 h-72 w-full rounded-lg" />
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <Skeleton className="h-5 w-36" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-10 w-full rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TablePageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-5", className)} role="status" aria-live="polite" aria-label="Loading table content">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 max-w-[70vw]" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, idx) => (
            <Skeleton key={idx} className="h-9 w-full rounded-lg" />
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="grid grid-cols-12 gap-2 border-b border-border/60 bg-muted/40 p-3">
          {Array.from({ length: 12 }).map((_, idx) => (
            <Skeleton key={idx} className="h-4 w-full" />
          ))}
        </div>
        <div className="space-y-2 p-3">
          {Array.from({ length: 8 }).map((_, rowIdx) => (
            <div key={rowIdx} className="grid grid-cols-12 gap-2 rounded-md border border-border/50 p-2">
              {Array.from({ length: 12 }).map((_, colIdx) => (
                <Skeleton key={colIdx} className="h-4 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DetailPageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-5", className)} role="status" aria-live="polite" aria-label="Loading details">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <Skeleton className="h-4 w-36" />
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-9 w-56" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-24" />
            </div>
            <Skeleton className="h-5 w-72 max-w-[80vw]" />
            <div className="flex flex-wrap gap-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-32 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <Skeleton className="h-5 w-40" />
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Array.from({ length: 8 }).map((_, idx) => (
                <Skeleton key={idx} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="mt-4 h-48 w-full rounded-lg" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <Skeleton className="h-5 w-36" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 5 }).map((_, idx) => (
                <Skeleton key={idx} className="h-10 w-full rounded-md" />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <Skeleton className="h-5 w-28" />
            <div className="mt-4 space-y-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={idx} className="h-4 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChartPageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-5", className)} role="status" aria-live="polite" aria-label="Loading analytics charts">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56 max-w-[65vw]" />
        <Skeleton className="h-4 w-72 max-w-[80vw]" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div
          className="rounded-xl border border-border bg-card p-4 shadow-sm [&_.skeleton]:[animation-delay:var(--sk-delay)] [&_.skeleton]:[animation-duration:2.6s]"
          style={{ ["--sk-delay" as string]: "0ms" } as React.CSSProperties}
        >
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="relative h-[240px] sm:h-[300px]">
            <Skeleton className="absolute left-0 top-0 h-full w-8" />
            <Skeleton className="absolute bottom-0 left-10 h-6 w-[calc(100%-2.5rem)]" />
            <div className="absolute left-10 top-3 right-2 space-y-3">
              {Array.from({ length: 5 }).map((_, idx) => (
                <Skeleton key={idx} className="h-3 w-full" />
              ))}
            </div>
            <div className="absolute bottom-6 left-12 right-6 flex items-end gap-3">
              {Array.from({ length: 8 }).map((_, idx) => (
                <Skeleton
                  key={idx}
                  className="w-full rounded-t-sm"
                  style={{ height: `${40 + ((idx * 17) % 120)}px` }}
                />
              ))}
            </div>
          </div>
        </div>

        <div
          className="rounded-xl border border-border bg-card p-4 shadow-sm [&_.skeleton]:[animation-delay:var(--sk-delay)] [&_.skeleton]:[animation-duration:2.6s]"
          style={{ ["--sk-delay" as string]: "120ms" } as React.CSSProperties}
        >
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex items-center justify-center py-4">
            <Skeleton className="h-44 w-44 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-2 pt-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded-md border border-border/60 p-2">
                <Skeleton className="h-3 w-3 rounded-full" />
                <Skeleton className="h-3 flex-1" />
              </div>
            ))}
          </div>
        </div>

        <div
          className="rounded-xl border border-border bg-card p-4 shadow-sm [&_.skeleton]:[animation-delay:var(--sk-delay)] [&_.skeleton]:[animation-duration:2.6s]"
          style={{ ["--sk-delay" as string]: "240ms" } as React.CSSProperties}
        >
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="relative h-[240px] sm:h-[300px]">
            <Skeleton className="absolute left-0 top-0 h-full w-8" />
            <Skeleton className="absolute bottom-0 left-10 h-6 w-[calc(100%-2.5rem)]" />
            <div className="absolute left-10 top-3 right-2 space-y-3">
              {Array.from({ length: 5 }).map((_, idx) => (
                <Skeleton key={idx} className="h-3 w-full" />
              ))}
            </div>
            <Skeleton className="absolute left-12 right-6 top-10 h-2 rounded-full" />
            <Skeleton className="absolute left-16 right-8 top-20 h-2 rounded-full" />
            <Skeleton className="absolute left-14 right-5 top-32 h-2 rounded-full" />
            <Skeleton className="absolute left-12 right-7 top-44 h-2 rounded-full" />
          </div>
        </div>

        <div
          className="rounded-xl border border-border bg-card p-4 shadow-sm [&_.skeleton]:[animation-delay:var(--sk-delay)] [&_.skeleton]:[animation-duration:2.6s]"
          style={{ ["--sk-delay" as string]: "360ms" } as React.CSSProperties}
        >
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 7 }).map((_, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <Skeleton className="h-2.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  error,
  onRetry,
  className,
}: {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const structured = error && typeof error === "object" ? error as { message?: unknown; code?: unknown } : null;
  const rawMessage = error instanceof Error
    ? error.message
    : typeof structured?.message === "string"
      ? structured.message
      : "The requested data could not be loaded.";
  const code = typeof structured?.code === "string" ? structured.code : null;
  const message = code ? `${rawMessage} (code ${code})` : rawMessage;
  return (
    <div className={cn("flex min-h-48 flex-col items-center justify-center rounded-xl border border-destructive/25 bg-destructive/5 p-6 text-center", className)} role="alert">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <h2 className="mt-3 font-semibold text-foreground">{title}</h2>
      <p className="mt-1 max-w-lg text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button type="button" variant="outline" className="mt-5" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
        </Button>
      )}
    </div>
  );
}
