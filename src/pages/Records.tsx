import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Search, Download, X, Loader2, BookmarkPlus, Bookmark, Trash2, MapPin, CalendarDays, ChevronRight } from "lucide-react";
import { useIncidents } from "@/hooks/useIncidents";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  updateIncidentStatus,
  LIFECYCLE_STATUSES,
  STATUS_LABELS,
  SEVERITY_LABELS,
  recordExport,
  listQueryTemplates,
  saveQueryTemplate,
  deleteQueryTemplate,
  type IncidentStatus,
  type IncidentSeverity,
  type QueryFilters,
} from "@/lib/incidents";
import { incidentsToCSV, downloadBlob, timestampedName } from "@/lib/exporters";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "@/components/ReliabilityState";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { Textarea } from "@/components/ui/textarea";

const statusClass: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-info/10 text-info border border-info/20",
  under_review: "bg-warning/10 text-warning border border-warning/20",
  returned: "bg-destructive/10 text-destructive border border-destructive/20",
  verified: "bg-success/10 text-success border border-success/20",
  Closed: "bg-muted text-muted-foreground",
  archived: "bg-muted text-muted-foreground",
  New: "bg-info/10 text-info border border-info/20",
  Reviewed: "bg-warning/10 text-warning border border-warning/20",
};

const severityClass: Record<IncidentSeverity, string> = {
  low: "bg-success/10 text-success",
  medium: "bg-info/10 text-info",
  high: "bg-warning/10 text-warning",
  critical: "bg-destructive/10 text-destructive",
};

export default function Records() {
  const incidentsQuery = useIncidents();
  const { data: incidents = [], isLoading, isError, error, refetch } = incidentsQuery;
  const { can, allowedTransitions } = useRole();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [districtFilter, setDistrictFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [reporterFilter, setReporterFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const urlCategory = searchParams.get("category");
  const urlStatus = searchParams.get("status");
  const urlId = searchParams.get("id");
  useEffect(() => {
    if (urlCategory) setCategoryFilter(urlCategory);
    if (urlStatus) setStatusFilter(urlStatus);
  }, [urlCategory, urlStatus]);

  // Templates
  const templatesQuery = useQuery({ queryKey: ["query-templates"], queryFn: listQueryTemplates });
  const { data: templates = [] } = templatesQuery;
  const [saveOpen, setSaveOpen] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplDesc, setTplDesc] = useState("");
  const [tplShared, setTplShared] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<{ id: string; reference: string; status: IncidentStatus } | null>(null);
  const [transitionNote, setTransitionNote] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);

  const currentFilters: QueryFilters = {
    search: searchTerm || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    region: regionFilter !== "all" ? regionFilter : undefined,
    district: districtFilter !== "all" ? districtFilter : undefined,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
    product_type: productFilter !== "all" ? productFilter : undefined,
    severity: severityFilter !== "all" ? severityFilter : undefined,
    reporter: reporterFilter || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  };

  const applyTemplate = (def: QueryFilters) => {
    setSearchTerm(def.search ?? "");
    setStatusFilter(def.status ?? "all");
    setRegionFilter(def.region ?? "all");
    setDistrictFilter(def.district ?? "all");
    setCategoryFilter(def.category ?? "all");
    setProductFilter(def.product_type ?? "all");
    setSeverityFilter(def.severity ?? "all");
    setReporterFilter(def.reporter ?? "");
    setDateFrom(def.date_from ?? "");
    setDateTo(def.date_to ?? "");
  };

  const resetFilters = () => {
    setSearchTerm(""); setStatusFilter("all"); setRegionFilter("all"); setDistrictFilter("all");
    setCategoryFilter("all"); setProductFilter("all"); setSeverityFilter("all");
    setReporterFilter(""); setDateFrom(""); setDateTo("");
    setSearchParams({});
  };

  const filtered = useMemo(() => {
    return incidents.filter((inc) => {
      if (urlId && inc.id !== urlId && inc.reference_code !== urlId) return false;
      if (statusFilter !== "all" && inc.status !== statusFilter) return false;
      if (regionFilter !== "all" && inc.region !== regionFilter) return false;
      if (districtFilter !== "all" && inc.district !== districtFilter) return false;
      if (categoryFilter !== "all" && inc.category !== categoryFilter) return false;
      if (productFilter !== "all" && inc.product_type !== productFilter) return false;
      if (severityFilter !== "all" && inc.severity !== severityFilter) return false;
      if (reporterFilter && !(inc.reporter_name || "").toLowerCase().includes(reporterFilter.toLowerCase())) return false;
      if (dateFrom && inc.incident_date < dateFrom) return false;
      if (dateTo && inc.incident_date > dateTo) return false;
      const q = searchTerm.toLowerCase();
      if (!q) return true;
      return (
        (inc.reference_code || "").toLowerCase().includes(q) ||
        inc.region.toLowerCase().includes(q) ||
        inc.category.toLowerCase().includes(q) ||
        inc.location_name.toLowerCase().includes(q) ||
        (inc.description || "").toLowerCase().includes(q)
      );
    });
  }, [incidents, urlId, searchTerm, statusFilter, regionFilter, districtFilter, categoryFilter, productFilter, severityFilter, reporterFilter, dateFrom, dateTo]);

  const regions = useMemo(() => Array.from(new Set(incidents.map((i) => i.region).filter(Boolean))).sort(), [incidents]);
  const districts = useMemo(() => Array.from(new Set(incidents.map((i) => i.district).filter(Boolean))).sort() as string[], [incidents]);
  const categories = useMemo(() => Array.from(new Set(incidents.map((i) => i.category).filter(Boolean))).sort(), [incidents]);
  const products = useMemo(() => Array.from(new Set(incidents.map((i) => i.product_type).filter(Boolean))).sort() as string[], [incidents]);

  const handleStatusChange = async () => {
    if (!pendingTransition || !transitionNote.trim()) return;
    setIsTransitioning(true);
    try {
      await updateIncidentStatus(pendingTransition.id, pendingTransition.status, transitionNote.trim());
      await qc.invalidateQueries({ queryKey: ["incidents"] });
      toast.success(`Status updated to ${STATUS_LABELS[pendingTransition.status] || pendingTransition.status}`);
      setPendingTransition(null);
      setTransitionNote("");
    } catch (err: any) {
      toast.error(err.message || "Update failed");
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleExport = async () => {
    const csv = incidentsToCSV(filtered);
    const name = timestampedName("npa_incidents", "csv");
    downloadBlob(name, csv, "text/csv;charset=utf-8");
    toast.success(`Exported ${filtered.length} records`);
    if (user) {
      try {
        await recordExport({
          userId: user.id,
          userEmail: user.email ?? null,
          format: "csv",
          fileName: name,
          rowCount: filtered.length,
          fileSize: csv.length,
          filters: currentFilters,
        });
      } catch { /* non-fatal */ }
    }
  };

  const handleSaveTemplate = async () => {
    if (!user || !tplName.trim()) return;
    try {
      await saveQueryTemplate({
        ownerId: user.id,
        name: tplName.trim(),
        description: tplDesc.trim() || undefined,
        definition: currentFilters,
        isShared: tplShared,
      });
      toast.success("Query template saved");
      setSaveOpen(false); setTplName(""); setTplDesc(""); setTplShared(false);
      qc.invalidateQueries({ queryKey: ["query-templates"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;
    setIsDeletingTemplate(true);
    try {
      await deleteQueryTemplate(templateToDelete.id);
      await qc.invalidateQueries({ queryKey: ["query-templates"] });
      toast.success("Template removed");
      setTemplateToDelete(null);
    } catch (err: any) { toast.error(err.message); }
    finally { setIsDeletingTemplate(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Incident Records</h1>
          <p className="meta-text mt-1">{isLoading ? "Loading..." : `${filtered.length} of ${incidents.length} records`}</p>
        </div>
        <div className="grid grid-cols-1 sm:flex gap-2 w-full sm:w-auto">
          {can("manage_templates") && (
            <Button variant="outline" onClick={() => setSaveOpen(true)} disabled={!user} className="w-full sm:w-auto">
              <BookmarkPlus className="h-4 w-4 mr-1" /> Save Filter
            </Button>
          )}
          {can("export_data") && (
            <Button variant="default" onClick={handleExport} disabled={!filtered.length} className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-1" /> Export ({filtered.length})
            </Button>
          )}
        </div>
      </div>

      {templates.length > 0 && (
        <div className="dash-card py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Bookmark className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-medium text-foreground shrink-0">Saved filters:</span>
            {templates.map((t: any) => (
              <div key={t.id} className="inline-flex items-center gap-1">
                <button
                  onClick={() => applyTemplate(t.definition as QueryFilters)}
                  className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted/40 hover:bg-muted text-foreground"
                  title={t.description || t.name}
                >
                  {t.name}{t.is_shared && " ★"}
                </button>
                {t.owner_id === user?.id && (
                  <button onClick={() => setTemplateToDelete({ id: t.id, name: t.name })} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Delete ${t.name}`}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {templatesQuery.isError && (
        <div className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span>Saved filters could not be loaded. Incident records are still available.</span>
          <Button size="sm" variant="outline" onClick={() => void templatesQuery.refetch()}>Retry filters</Button>
        </div>
      )}

      <div className="dash-card space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reference, region, location, description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-muted/50 border-border rounded-lg"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-muted/50 border-border rounded-lg"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All Status</SelectItem>
              {LIFECYCLE_STATUSES.map((s) => (<SelectItem key={s} value={s}>{STATUS_LABELS[s] || s}</SelectItem>))}
              <SelectItem value="New">New (legacy)</SelectItem>
              <SelectItem value="Reviewed">Reviewed (legacy)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="bg-muted/50 border-border rounded-lg"><SelectValue placeholder="Severity" /></SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All Severity</SelectItem>
              {Object.entries(SEVERITY_LABELS).map(([v, l]) => (<SelectItem key={v} value={v}>{l}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger className="bg-muted/50 border-border rounded-lg"><SelectValue placeholder="Region" /></SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All Regions</SelectItem>
              {regions.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={districtFilter} onValueChange={setDistrictFilter}>
            <SelectTrigger className="bg-muted/50 border-border rounded-lg"><SelectValue placeholder="District" /></SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All Districts</SelectItem>
              {districts.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="bg-muted/50 border-border rounded-lg"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="bg-muted/50 border-border rounded-lg"><SelectValue placeholder="Product" /></SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All Products</SelectItem>
              {products.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
            </SelectContent>
          </Select>
          <Input placeholder="Reporter…" value={reporterFilter} onChange={(e) => setReporterFilter(e.target.value)} className="bg-muted/50 border-border rounded-lg" />
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-muted/50 border-border rounded-lg" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-muted/50 border-border rounded-lg" />
          <Button variant="ghost" onClick={resetFilters} className="text-xs">
            <X className="h-3 w-3 mr-1" /> Reset all
          </Button>
        </div>
      </div>

      {isLoading ? <LoadingState label="Loading incident records…" /> : isError ? (
        <ErrorState title="Incident records are unavailable" error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm md:block">
            <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[1120px] text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b border-border">
                  <th className="data-table-header text-left py-3 px-4">Reference</th>
                  <th className="data-table-header text-left py-3 px-4">Date</th>
                  <th className="data-table-header text-left py-3 px-4">Region</th>
                  <th className="data-table-header text-left py-3 px-4">Location</th>
                  <th className="data-table-header text-left py-3 px-4">Category</th>
                  <th className="data-table-header text-left py-3 px-4">Product</th>
                  <th className="data-table-header text-left py-3 px-4">Severity</th>
                  <th className="data-table-header text-right py-3 px-4">Cas.</th>
                  <th className="data-table-header text-right py-3 px-4">Fat.</th>
                  <th className="data-table-header text-left py-3 px-4">Reporter</th>
                  <th className="data-table-header text-left py-3 px-4">Status</th>
                  {can("edit_records") && <th className="data-table-header text-left py-3 px-4">Transition</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((inc) => (
                  <tr key={inc.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium tabular-nums">
                      <Link className="text-primary hover:underline underline-offset-4" to={`/incidents/${inc.id}`}>
                        {inc.reference_code || inc.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-3 px-4 tabular-nums text-muted-foreground">{inc.incident_date}</td>
                    <td className="py-3 px-4 text-muted-foreground">{inc.region}</td>
                    <td className="py-3 px-4 max-w-[160px] truncate text-muted-foreground">{inc.location_name}</td>
                    <td className="py-3 px-4 text-muted-foreground">{inc.category}</td>
                    <td className="py-3 px-4 text-muted-foreground">{inc.product_type}</td>
                    <td className="py-3 px-4">
                      <Badge variant="secondary" className={severityClass[inc.severity as IncidentSeverity] || ""}>
                        {SEVERITY_LABELS[inc.severity as IncidentSeverity] || inc.severity}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">{inc.casualties}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">{inc.fatalities}</td>
                    <td className="py-3 px-4 max-w-[140px] truncate text-muted-foreground">{inc.reporter_name}</td>
                    <td className="py-3 px-4">
                      <Badge className={statusClass[inc.status] || ""} variant="secondary">
                        {STATUS_LABELS[inc.status] || inc.status}
                      </Badge>
                    </td>
                    {can("edit_records") && (
                      <td className="py-3 px-4">
                        {allowedTransitions(inc.status).length ? (
                          <Select onValueChange={(v) => setPendingTransition({ id: inc.id, reference: inc.reference_code || inc.id.slice(0, 8), status: v as IncidentStatus })}>
                            <SelectTrigger className="h-8 w-40 text-xs bg-muted/50 border-border rounded-lg"><SelectValue placeholder="Choose action" /></SelectTrigger>
                            <SelectContent className="bg-card border-border">
                              {allowedTransitions(inc.status).map((s) => (
                                <SelectItem key={s} value={s}>{STATUS_LABELS[s] || s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : <span className="text-xs text-muted-foreground">No transition</span>}
                      </td>
                    )}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={12} className="text-center py-10 text-sm text-muted-foreground">
                      No records match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {filtered.map((inc) => (
              <article key={inc.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/incidents/${inc.id}`} className="font-semibold tabular-nums text-primary hover:underline">
                      {inc.reference_code || inc.id.slice(0, 8)}
                    </Link>
                    <p className="mt-1 truncate text-sm font-medium text-foreground">{inc.category}</p>
                  </div>
                  <Badge className={statusClass[inc.status] || ""} variant="secondary">{STATUS_LABELS[inc.status] || inc.status}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0" />{inc.incident_date}</span>
                  <span className="flex min-w-0 items-center gap-2"><MapPin className="h-4 w-4 shrink-0" /><span className="truncate">{inc.location_name} · {inc.region}</span></span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className={severityClass[inc.severity as IncidentSeverity] || ""}>{SEVERITY_LABELS[inc.severity as IncidentSeverity]}</Badge>
                  {inc.product_type && <Badge variant="outline">{inc.product_type}</Badge>}
                  {(inc.casualties > 0 || inc.fatalities > 0) && <span className="text-xs text-muted-foreground">{inc.casualties} casualties · {inc.fatalities} fatalities</span>}
                </div>
                <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
                  {can("edit_records") && allowedTransitions(inc.status).length > 0 && (
                    <Select onValueChange={(v) => setPendingTransition({ id: inc.id, reference: inc.reference_code || inc.id.slice(0, 8), status: v as IncidentStatus })}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Change status…" /></SelectTrigger>
                      <SelectContent>{allowedTransitions(inc.status).map((status) => <SelectItem key={status} value={status}>{STATUS_LABELS[status] || status}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                  <Button asChild variant="outline" className="w-full justify-between">
                    <Link to={`/incidents/${inc.id}`}>Open case workspace <ChevronRight className="h-4 w-4" /></Link>
                  </Button>
                </div>
              </article>
            ))}
            {filtered.length === 0 && <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">No records match the current filters.</div>}
          </div>
        </>
      )}

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save current filters as template</DialogTitle>
            <DialogDescription>
              Save this filter combination for quick re-use. Shared templates are visible to all users.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Template name (e.g. Critical spills last 30 days)" value={tplName} onChange={(e) => setTplName(e.target.value)} />
            <Input placeholder="Description (optional)" value={tplDesc} onChange={(e) => setTplDesc(e.target.value)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={tplShared} onChange={(e) => setTplShared(e.target.checked)} />
              Share with all users
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTemplate} disabled={!tplName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingTransition)} onOpenChange={(open) => { if (!open && !isTransitioning) { setPendingTransition(null); setTransitionNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm status transition</DialogTitle>
            <DialogDescription>
              Move {pendingTransition?.reference} to {pendingTransition ? STATUS_LABELS[pendingTransition.status] || pendingTransition.status : ""}? This change is audit logged and may affect operational workflows.
            </DialogDescription>
          </DialogHeader>
          <Textarea value={transitionNote} onChange={(event) => setTransitionNote(event.target.value)} placeholder="Required: explain the decision and next steps…" maxLength={1000} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingTransition(null)} disabled={isTransitioning}>Cancel</Button>
            <Button onClick={handleStatusChange} disabled={!transitionNote.trim() || isTransitioning}>
              {isTransitioning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm transition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={Boolean(templateToDelete)}
        onOpenChange={(open) => !open && !isDeletingTemplate && setTemplateToDelete(null)}
        title="Delete saved filter?"
        description={`“${templateToDelete?.name || "This filter"}” will be permanently removed from your saved filters.`}
        confirmLabel="Delete filter"
        destructive
        pending={isDeletingTemplate}
        onConfirm={handleDeleteTemplate}
      />
    </div>
  );
}
