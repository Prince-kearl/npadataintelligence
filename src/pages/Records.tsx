import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Search, Download, X, Loader2, BookmarkPlus, Bookmark, Trash2 } from "lucide-react";
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
  const { data: incidents = [], isLoading } = useIncidents();
  const { can, allowedStatuses } = useRole();
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
  const urlId = searchParams.get("id");
  useEffect(() => {
    if (urlCategory) setCategoryFilter(urlCategory);
  }, [urlCategory]);

  // Templates
  const { data: templates = [] } = useQuery({ queryKey: ["query-templates"], queryFn: listQueryTemplates });
  const [saveOpen, setSaveOpen] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplDesc, setTplDesc] = useState("");
  const [tplShared, setTplShared] = useState(false);

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

  const handleStatusChange = async (id: string, status: IncidentStatus) => {
    try {
      await updateIncidentStatus(id, status);
      qc.invalidateQueries({ queryKey: ["incidents"] });
      toast.success(`Status updated to ${STATUS_LABELS[status] || status}`);
    } catch (err: any) {
      toast.error(err.message || "Update failed");
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

  const handleDeleteTemplate = async (id: string) => {
    try {
      await deleteQueryTemplate(id);
      qc.invalidateQueries({ queryKey: ["query-templates"] });
      toast.success("Template removed");
    } catch (err: any) { toast.error(err.message); }
  };

  const allowed = allowedStatuses();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Incident Records</h1>
          <p className="meta-text mt-1">{isLoading ? "Loading..." : `${filtered.length} of ${incidents.length} records`}</p>
        </div>
        <div className="flex items-center gap-2">
          {can("manage_templates") && (
            <Button variant="outline" onClick={() => setSaveOpen(true)} disabled={!user}>
              <BookmarkPlus className="h-4 w-4 mr-1" /> Save Filter
            </Button>
          )}
          {can("export_data") && (
            <Button variant="default" onClick={handleExport} disabled={!filtered.length}>
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
                  <button onClick={() => handleDeleteTemplate(t.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
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
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
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

      <div className="dash-card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
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
                    <td className="py-3 px-4 font-medium tabular-nums text-foreground">{inc.reference_code}</td>
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
                        <Select value={inc.status} onValueChange={(v) => handleStatusChange(inc.id, v as IncidentStatus)}>
                          <SelectTrigger className="h-8 w-36 text-xs bg-muted/50 border-border rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            {allowed.map((s) => (
                              <SelectItem key={s} value={s}>{STATUS_LABELS[s] || s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
        )}
      </div>

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
    </div>
  );
}
