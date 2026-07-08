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
import { Search, Download, X, Loader2, BookmarkPlus, Bookmark, Trash2, MapPin, CalendarDays, ChevronRight, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ExcelImportDialog, { type ImportedIncident } from "@/components/ExcelImportDialog";
import BulkImportReviewDialog from "@/components/BulkImportReviewDialog";
import { REGIONS, INCIDENT_CATEGORIES, INCIDENT_TYPES, PRODUCT_TYPES, INJURY_TYPES, REPORT_SOURCES } from "@/lib/incident-options";
import { useIncidents } from "@/hooks/useIncidents";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  updateIncidentStatus,
  LIFECYCLE_STATUSES,
  STATUS_LABELS,
  recordExport,
  listDeletedIncidents,
  restoreIncidentRecord,
  listQueryTemplates,
  saveQueryTemplate,
  updateQueryTemplate,
  deleteQueryTemplate,
  type IncidentStatus,
  type QueryFilters,
} from "@/lib/incidents";
import { incidentsToCSV, downloadBlob, timestampedName } from "@/lib/exporters";
import { toast } from "sonner";
import { ErrorState, LoadingState, TablePageSkeleton } from "@/components/ReliabilityState";
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

const TRASH_PAGE_SIZE = 8;

export default function Records() {
  const incidentsQuery = useIncidents();
  const { data: incidents = [], isLoading, isError, error, refetch } = incidentsQuery;
  const { can, allowedTransitions } = useRole();
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [districtFilter, setDistrictFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  
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
  const [editOpen, setEditOpen] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplDesc, setTplDesc] = useState("");
  const [tplShared, setTplShared] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<{ id: string; reference: string; status: IncidentStatus } | null>(null);
  const [transitionNote, setTransitionNote] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [trashSearch, setTrashSearch] = useState("");
  const [trashPage, setTrashPage] = useState(1);
  const [pendingRestore, setPendingRestore] = useState<{ id: string; reference: string } | null>(null);
  const [restoreReason, setRestoreReason] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRows, setReviewRows] = useState<ImportedIncident[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const matchOption = <T extends string>(value: string | undefined, options: readonly T[]): T | undefined => {
    if (!value) return undefined;
    const v = value.toLowerCase().trim();
    return (
      options.find((o) => o.toLowerCase() === v) ||
      options.find((o) => o.toLowerCase().includes(v) || v.includes(o.toLowerCase()))
    );
  };

  // Step 1: after the user maps columns, normalize enum values and open the review dialog
  // so they can preview and complete each incident before we hit the database.
  const handleMappedRows = (rows: ImportedIncident[]) => {
    if (!rows.length) {
      toast.error("No rows detected in the spreadsheet.");
      return;
    }
    const normalized: ImportedIncident[] = rows.map((r) => ({
      ...r,
      region: matchOption(r.region, REGIONS) ?? r.region,
      category: matchOption(r.category, INCIDENT_CATEGORIES) ?? r.category,
      incidentType: matchOption(r.incidentType, INCIDENT_TYPES) ?? r.incidentType,
      productType: matchOption(r.productType, PRODUCT_TYPES) ?? r.productType,
      injuryType: matchOption(r.injuryType, INJURY_TYPES) ?? r.injuryType,
      source: matchOption(r.source, REPORT_SOURCES) ?? r.source,
      casualties: r.casualties ?? 0,
      fatalities: r.fatalities ?? 0,
    }));
    setReviewRows(normalized);
    setImportOpen(false);
    setReviewOpen(true);
  };

  // Step 2: user has reviewed and completed the records — save them straight into the DB.
  const handleReviewSubmit = async (rows: ImportedIncident[]) => {
    if (!user) {
      toast.error("You must be signed in to import records.");
      return;
    }
    setIsImporting(true);
    const payloads = rows.map((r) => ({
      reporter_id: user.id,
      reporter_name: profile?.full_name || profile?.email || "Bulk import",
      department: profile?.department || null,
      incident_date: r.incidentDate!,
      region: r.region!,
      district: r.district || null,
      location_name: r.locationName!,
      gps_coordinates: r.gps || null,
      category: r.category!,
      incident_type: r.incidentType || null,
      product_type: r.productType || null,
      injury_type: r.injuryType || null,
      casualties: r.casualties ?? 0,
      fatalities: r.fatalities ?? 0,
      description: r.description!,
      source: r.source || null,
      status: "New" as const,
    }));

    const BATCH_SIZE = 500;
    let inserted = 0;
    let failed = 0;
    for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
      const batch = payloads.slice(i, i + BATCH_SIZE);
      const { error, data } = await supabase.from("incidents").insert(batch).select("id");
      if (error) {
        failed += batch.length;
        console.error(`Batch import failed at row ${i}:`, error);
      } else {
        inserted += data?.length ?? batch.length;
      }
    }
    setIsImporting(false);
    qc.invalidateQueries({ queryKey: ["incidents"] });
    if (inserted) {
      setReviewOpen(false);
      setReviewRows([]);
      toast.success(`Saved ${inserted} incident${inserted === 1 ? "" : "s"} to records`, {
        description: failed ? `${failed} failed to save — check console for details.` : undefined,
      });
    } else {
      toast.error("Import failed", { description: "No records were saved." });
    }
  };

  const deletedIncidentsQuery = useQuery({
    queryKey: ["deleted-incidents"],
    queryFn: () => listDeletedIncidents(200),
    enabled: can("manage_users") && showTrash,
  });
  const { data: deletedIncidents = [] } = deletedIncidentsQuery;

  const filteredTrash = useMemo(() => {
    const q = trashSearch.trim().toLowerCase();
    if (!q) return deletedIncidents;
    return deletedIncidents.filter((inc) =>
      [inc.reference_code, inc.region, inc.category, inc.location_name, inc.district]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [deletedIncidents, trashSearch]);

  const trashTotalPages = Math.max(1, Math.ceil(filteredTrash.length / TRASH_PAGE_SIZE));
  const trashStart = (trashPage - 1) * TRASH_PAGE_SIZE;
  const pagedTrash = filteredTrash.slice(trashStart, trashStart + TRASH_PAGE_SIZE);

  useEffect(() => {
    setTrashPage((prev) => Math.min(prev, trashTotalPages));
  }, [trashTotalPages]);

  useEffect(() => {
    setTrashPage(1);
  }, [trashSearch]);

  const currentFilters: QueryFilters = {
    search: searchTerm || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    region: regionFilter !== "all" ? regionFilter : undefined,
    district: districtFilter !== "all" ? districtFilter : undefined,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
    product_type: productFilter !== "all" ? productFilter : undefined,
    
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
    
    setReporterFilter(def.reporter ?? "");
    setDateFrom(def.date_from ?? "");
    setDateTo(def.date_to ?? "");
  };

  const resetFilters = () => {
    setSearchTerm(""); setStatusFilter("all"); setRegionFilter("all"); setDistrictFilter("all");
    setCategoryFilter("all"); setProductFilter("all");
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
  }, [incidents, urlId, searchTerm, statusFilter, regionFilter, districtFilter, categoryFilter, productFilter, reporterFilter, dateFrom, dateTo]);

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
    const name = timestampedName("cdis_incidents", "csv");
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

  const handleRestoreIncident = async () => {
    if (!pendingRestore) return;
    setIsRestoring(true);
    try {
      await restoreIncidentRecord(pendingRestore.id, restoreReason.trim() || undefined);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["incidents"] }),
        qc.invalidateQueries({ queryKey: ["deleted-incidents"] }),
      ]);
      toast.success("Incident restored");
      setPendingRestore(null);
      setRestoreReason("");
    } catch (err: any) {
      toast.error(err.message || "Could not restore incident");
    } finally {
      setIsRestoring(false);
    }
  };

  const openEditTemplate = (tpl: any) => {
    setEditingTemplateId(tpl.id);
    setTplName(tpl.name || "");
    setTplDesc(tpl.description || "");
    setTplShared(Boolean(tpl.is_shared));
    setEditOpen(true);
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplateId || !tplName.trim()) return;
    try {
      await updateQueryTemplate({
        id: editingTemplateId,
        name: tplName.trim(),
        description: tplDesc.trim() || undefined,
        definition: currentFilters,
        isShared: tplShared,
      });
      toast.success("Template updated");
      setEditOpen(false);
      setEditingTemplateId(null);
      setTplName("");
      setTplDesc("");
      setTplShared(false);
      await qc.invalidateQueries({ queryKey: ["query-templates"] });
    } catch (err: any) {
      toast.error(err.message || "Template update failed");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Incident Records</h1>
          <p className="meta-text mt-1">{isLoading ? "Loading..." : `${filtered.length} of ${incidents.length} records`}</p>
        </div>
        <div className="grid grid-cols-1 sm:flex gap-2 w-full sm:w-auto">
          {can("submit_incident") && (
            <Button variant="outline" onClick={() => setImportOpen(true)} disabled={!user} className="w-full sm:w-auto">
              <Upload className="h-4 w-4 mr-1" /> Import Excel
            </Button>
          )}
          {can("manage_users") && (
            <Button variant="outline" onClick={() => setShowTrash((v) => !v)} className="w-full sm:w-auto">
              <Trash2 className="h-4 w-4 mr-1" /> {showTrash ? "Hide Trash" : "Show Trash"}
            </Button>
          )}
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

      <ExcelImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        mode="bulk"
        busy={isImporting}
        onBulkApply={handleMappedRows}
      />

      <BulkImportReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        rows={reviewRows}
        busy={isImporting}
        onSubmit={handleReviewSubmit}
      />

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
                  <div className="inline-flex items-center gap-1">
                    <button onClick={() => openEditTemplate(t)} className="rounded p-1 text-muted-foreground hover:bg-info/10 hover:text-info" aria-label={`Edit ${t.name}`}>
                      <Bookmark className="h-3 w-3" />
                    </button>
                    <button onClick={() => setTemplateToDelete({ id: t.id, name: t.name })} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Delete ${t.name}`}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
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

      {can("manage_users") && showTrash && (
        <div className="dash-card space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="section-title">Deleted Incident Records</h3>
            <span className="text-xs text-muted-foreground">{filteredTrash.length} deleted</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={trashSearch}
              onChange={(e) => setTrashSearch(e.target.value)}
              placeholder="Search deleted incidents by reference, region, category, or location..."
              className="pl-9"
            />
          </div>
          {deletedIncidentsQuery.isLoading && <LoadingState label="Loading deleted incidents…" className="min-h-28" />}
          {deletedIncidentsQuery.isError && <ErrorState title="Deleted incidents could not be loaded" error={deletedIncidentsQuery.error} onRetry={() => void deletedIncidentsQuery.refetch()} className="min-h-28" />}
          {!deletedIncidentsQuery.isLoading && !deletedIncidentsQuery.isError && filteredTrash.length === 0 && (
            <p className="text-sm text-muted-foreground">No deleted incidents available.</p>
          )}
          {!deletedIncidentsQuery.isLoading && !deletedIncidentsQuery.isError && filteredTrash.length > 0 && (
            <div className="overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b border-border">
                    <th className="data-table-header text-left py-2.5 px-3">Reference</th>
                    <th className="data-table-header text-left py-2.5 px-3">Date</th>
                    <th className="data-table-header text-left py-2.5 px-3">Region</th>
                    <th className="data-table-header text-left py-2.5 px-3">Category</th>
                    <th className="data-table-header text-left py-2.5 px-3">Deleted At</th>
                    <th className="data-table-header text-left py-2.5 px-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedTrash.map((inc) => (
                    <tr key={inc.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 tabular-nums text-foreground font-medium">{inc.reference_code || inc.id.slice(0, 8)}</td>
                      <td className="py-2.5 px-3 tabular-nums text-muted-foreground">{inc.incident_date}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{inc.region}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{inc.category}</td>
                      <td className="py-2.5 px-3 tabular-nums text-muted-foreground">{inc.deleted_at ? new Date(inc.deleted_at).toLocaleString() : "—"}</td>
                      <td className="py-2.5 px-3">
                        <Button size="sm" variant="outline" onClick={() => setPendingRestore({ id: inc.id, reference: inc.reference_code || inc.id.slice(0, 8) })}>Restore</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!deletedIncidentsQuery.isLoading && !deletedIncidentsQuery.isError && filteredTrash.length > TRASH_PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">
                Showing {trashStart + 1}-{trashStart + pagedTrash.length} of {filteredTrash.length}
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={trashPage === 1} onClick={() => setTrashPage((p) => p - 1)}>Previous</Button>
                <span className="text-xs text-muted-foreground tabular-nums">Page {trashPage} of {trashTotalPages}</span>
                <Button size="sm" variant="outline" disabled={trashPage === trashTotalPages} onClick={() => setTrashPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
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

      {isLoading ? <TablePageSkeleton /> : isError ? (
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
                  <th className="data-table-header text-left py-3 px-4">District</th>
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
                    <td className="py-3 px-4 text-muted-foreground">{inc.district || "—"}</td>
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
                  {inc.district && <Badge variant="outline">{inc.district}</Badge>}
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

      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) { setEditOpen(false); setEditingTemplateId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update saved template</DialogTitle>
            <DialogDescription>
              Rename this template and overwrite it with your current filters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Template name" value={tplName} onChange={(e) => setTplName(e.target.value)} />
            <Input placeholder="Description (optional)" value={tplDesc} onChange={(e) => setTplDesc(e.target.value)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={tplShared} onChange={(e) => setTplShared(e.target.checked)} />
              Share with all users
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateTemplate} disabled={!tplName.trim()}>Update</Button>
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

      <Dialog open={Boolean(pendingRestore)} onOpenChange={(open) => { if (!open && !isRestoring) { setPendingRestore(null); setRestoreReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore deleted incident?</DialogTitle>
            <DialogDescription>
              Restore {pendingRestore?.reference} to active records. Include a reason for audit traceability.
            </DialogDescription>
          </DialogHeader>
          <Textarea value={restoreReason} onChange={(e) => setRestoreReason(e.target.value)} placeholder="Reason for restoring this incident (optional but recommended)…" maxLength={1000} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingRestore(null)} disabled={isRestoring}>Cancel</Button>
            <Button onClick={handleRestoreIncident} disabled={isRestoring}>
              {isRestoring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
