import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LoadingState({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-8", className)} role="status" aria-live="polite">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
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
