import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, CheckCircle2, ExternalLink, Loader2, MailCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageSkeleton, ErrorState } from "@/components/ReliabilityState";
import { closeCase, listCases, type CaseRow, type CaseStatus } from "@/lib/cases";

type EnrichedCase = CaseRow & { incident_reference: string | null; incident_meta?: any };

function StatusBadge({ status }: { status: CaseStatus }) {
  if (status === "open") return <Badge className="bg-warning/10 text-warning border border-warning/20">OPEN</Badge>;
  return <Badge className="bg-success/10 text-success border border-success/20">CLOSED</Badge>;
}

function EmailBadge({ status }: { status: string | null }) {
  const cls =
    status === "sent"
      ? "bg-success/10 text-success border border-success/20"
      : status === "failed"
      ? "bg-destructive/10 text-destructive border border-destructive/20"
      : "bg-muted text-muted-foreground border border-border";
  return <Badge className={cls}>Email: {status || "pending"}</Badge>;
}

export default function Cases() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<CaseStatus>("open");
  const [closing, setClosing] = useState<EnrichedCase | null>(null);
  const [resolution, setResolution] = useState("");

  const cases = useQuery({
    queryKey: ["cases", tab],
    queryFn: () => listCases(tab),
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      if (!closing) throw new Error("No case selected");
      return closeCase(closing.id, resolution.trim());
    },
    onSuccess: () => {
      toast.success("Case closed");
      setClosing(null);
      setResolution("");
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
    onError: (err: Error) => toast.error(err.message || "Could not close case"),
  });

  const rows: EnrichedCase[] = useMemo(() => (cases.data as EnrichedCase[]) ?? [], [cases.data]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2"><Briefcase className="h-6 w-6 text-primary" />Case Management</h1>
          <p className="meta-text mt-1">Track incident escalations across their OPEN → CLOSED lifecycle.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as CaseStatus)}>
        <TabsList>
          <TabsTrigger value="open" className="gap-2"><Loader2 className="h-3.5 w-3.5" />Open</TabsTrigger>
          <TabsTrigger value="closed" className="gap-2"><CheckCircle2 className="h-3.5 w-3.5" />Closed</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {cases.isLoading ? (
            <PageSkeleton />
          ) : cases.isError ? (
            <ErrorState title="Cases unavailable" error={cases.error as Error} onRetry={() => void cases.refetch()} />
          ) : rows.length === 0 ? (
            <div className="dash-card text-center py-16">
              <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No {tab} cases at the moment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {rows.map((c) => (
                <div key={c.id} className="dash-card">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          className="text-primary font-semibold hover:underline underline-offset-4"
                          onClick={() => navigate(`/incidents/${c.incident_id}`)}
                        >
                          {c.incident_reference || c.incident_id.slice(0, 8)}
                        </button>
                        <StatusBadge status={c.status} />
                        <EmailBadge status={c.email_status} />
                      </div>
                      <p className="text-sm text-foreground">
                        <span className="font-medium">{c.directorate}</span>
                        {c.hod_name ? ` · ${c.hod_name}` : ""} · <a href={`mailto:${c.hod_email}`} className="text-primary hover:underline">{c.hod_email}</a>
                      </p>
                      {c.escalation_notes && (
                        <p className="text-xs text-muted-foreground line-clamp-2">Notes: {c.escalation_notes}</p>
                      )}
                      <p className="meta-text">
                        Opened {new Date(c.opened_at).toLocaleString()}
                        {c.opened_by_email ? ` by ${c.opened_by_email}` : ""}
                        {c.closed_at ? ` · Closed ${new Date(c.closed_at).toLocaleString()}` : ""}
                      </p>
                      {c.resolution_notes && (
                        <p className="text-xs text-muted-foreground border-l-2 border-success pl-2 mt-1">Resolution: {c.resolution_notes}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/incidents/${c.incident_id}`)}>
                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open incident
                      </Button>
                      {c.status === "open" && (
                        <Button size="sm" onClick={() => { setClosing(c); setResolution(""); }}>
                          <MailCheck className="h-3.5 w-3.5 mr-1" /> Record resolution
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!closing} onOpenChange={(o) => !o && setClosing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close case</DialogTitle>
            <DialogDescription>
              Record the resolution feedback from {closing?.directorate}. The case is marked CLOSED and audit-logged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="resolution">Resolution notes</Label>
            <Textarea
              id="resolution"
              rows={5}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="Summarise the actions taken and the outcome reported by the directorate…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClosing(null)} disabled={closeMutation.isPending}>Cancel</Button>
            <Button onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending || resolution.trim().length < 5}>
              {closeMutation.isPending ? "Closing…" : "Mark as closed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
