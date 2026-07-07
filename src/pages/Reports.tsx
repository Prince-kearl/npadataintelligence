import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, FileSpreadsheet, File, Database, Loader2, Filter, Eye, X } from "lucide-react";
import { toast } from "sonner";
import {
  incidentsToCSV,
  incidentsToSQLDump,
  incidentsToXLSX,
  incidentsToPDF,
  downloadBlob,
  timestampedName,
} from "@/lib/exporters";
import { useRole } from "@/hooks/useRole";
import { useIncidents } from "@/hooks/useIncidents";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ErrorState, LoadingState, PageSkeleton } from "@/components/ReliabilityState";
import { useMemo, useState } from "react";
import type { Database as SupabaseDatabase } from "@/integrations/supabase/types";

type ExportHistoryRow = SupabaseDatabase["public"]["Tables"]["export_history"]["Row"];

function formatBytes(bytes: number | null) {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function fetchExportHistory(): Promise<ExportHistoryRow[]> {
  const { data, error } = await supabase
    .from("export_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) throw error;
  return data ?? [];
}

async function logExportRow(payload: { file_name: string; format: string; row_count: number; file_size_bytes: number }) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const { error } = await supabase.from("export_history").insert({
    user_id: u.user.id,
    user_email: u.user.email,
    file_name: payload.file_name,
    format: payload.format,
    row_count: payload.row_count,
    file_size_bytes: payload.file_size_bytes,
  });
  if (error) throw error;
}

type Filters = {
  from: string;
  to: string;
  period: "all" | "month" | "quarter" | "year";
  periodValue: string;
  region: string;
  district: string;
  category: string;
  incidentType: string;
  productType: string;
  status: string;
};

const emptyFilters: Filters = {
  from: "",
  to: "",
  period: "all",
  periodValue: "",
  region: "all",
  district: "",
  category: "all",
  incidentType: "all",
  productType: "all",
  status: "all",
};

function uniq(values: (string | null | undefined)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v && v.trim() !== ""))).sort();
}

export default function Reports() {
  const { can } = useRole();
  const allowed = can("export_data");
  const incidentsQuery = useIncidents();
  const { data: incidents = [], isLoading, isError, error, refetch } = incidentsQuery;
  const qc = useQueryClient();
  const historyQuery = useQuery({ queryKey: ["export-history"], queryFn: fetchExportHistory });
  const { data: history = [] } = historyQuery;
  const [exporting, setExporting] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [showPreview, setShowPreview] = useState(false);

  const options = useMemo(() => ({
    regions: uniq(incidents.map((i: any) => i.region)),
    districts: uniq(incidents.map((i: any) => i.district)),
    categories: uniq(incidents.map((i: any) => i.category)),
    incidentTypes: uniq(incidents.map((i: any) => i.incident_type)),
    productTypes: uniq(incidents.map((i: any) => i.product_type)),
    statuses: uniq(incidents.map((i: any) => i.status)),
  }), [incidents]);

  const filtered = useMemo(() => {
    return incidents.filter((i: any) => {
      const d = i.incident_date ? new Date(i.incident_date) : null;
      if (filters.from && d && d < new Date(filters.from)) return false;
      if (filters.to && d && d > new Date(filters.to + "T23:59:59")) return false;
      if (filters.period !== "all" && filters.periodValue && d) {
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        if (filters.period === "year" && String(y) !== filters.periodValue) return false;
        if (filters.period === "month" && `${y}-${String(m).padStart(2, "0")}` !== filters.periodValue) return false;
        if (filters.period === "quarter") {
          const q = Math.ceil(m / 3);
          if (`${y}-Q${q}` !== filters.periodValue) return false;
        }
      }
      if (filters.region !== "all" && i.region !== filters.region) return false;
      if (filters.district && !(i.district ?? "").toLowerCase().includes(filters.district.toLowerCase())) return false;
      if (filters.category !== "all" && i.category !== filters.category) return false;
      if (filters.incidentType !== "all" && i.incident_type !== filters.incidentType) return false;
      if (filters.productType !== "all" && i.product_type !== filters.productType) return false;
      if (filters.status !== "all" && i.status !== filters.status) return false;
      return true;
    });
  }, [incidents, filters]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.from || filters.to) n++;
    if (filters.period !== "all" && filters.periodValue) n++;
    if (filters.region !== "all") n++;
    if (filters.district) n++;
    if (filters.category !== "all") n++;
    if (filters.incidentType !== "all") n++;
    if (filters.productType !== "all") n++;
    if (filters.status !== "all") n++;
    return n;
  }, [filters]);

  const recordExport = async (name: string, format: string, size: number) => {
    await logExportRow({ file_name: name, format, row_count: filtered.length, file_size_bytes: size });
    await qc.invalidateQueries({ queryKey: ["export-history"] });
  };

  const guard = () => {
    if (!allowed) { toast.error("Your role does not have permission to export data."); return false; }
    if (!filtered.length) { toast.error("No incidents match the selected filters."); return false; }
    return true;
  };

  const runExport = async (format: string, name: string, createBlob: () => Blob | Promise<Blob>) => {
    if (!guard()) return;
    setExporting(format);
    try {
      const blob = await createBlob();
      downloadBlob(name, blob);
      try {
        await recordExport(name, format, blob.size);
        toast.success(`${format} downloaded · ${filtered.length} rows · ${formatBytes(blob.size)}`);
      } catch (historyError) {
        toast.warning(`${format} downloaded, but its history entry could not be saved.`);
        console.error("Export history failed", historyError);
      }
    } catch (exportError) {
      toast.error(exportError instanceof Error ? exportError.message : `${format} export failed`);
    } finally {
      setExporting(null);
    }
  };

  const exportCSV = () => {
    const name = timestampedName("cdis_incidents", "csv");
    return runExport("CSV", name, () => new Blob([incidentsToCSV(filtered)], { type: "text/csv;charset=utf-8" }));
  };
  const exportExcel = async () => {
    const name = timestampedName("cdis_incidents", "xlsx");
    return runExport("XLSX", name, () => incidentsToXLSX(filtered));
  };
  const exportSQL = async () => {
    const name = timestampedName("cdis_incidents", "sql");
    return runExport("SQL", name, () => new Blob([incidentsToSQLDump(filtered)], { type: "application/sql;charset=utf-8" }));
  };
  const exportPDF = async () => {
    const name = timestampedName("cdis_report", "pdf");
    return runExport("PDF", name, () => incidentsToPDF(filtered));
  };

  const periodOptions = useMemo(() => {
    const set = new Set<string>();
    incidents.forEach((i: any) => {
      if (!i.incident_date) return;
      const d = new Date(i.incident_date);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      if (filters.period === "year") set.add(String(y));
      else if (filters.period === "month") set.add(`${y}-${String(m).padStart(2, "0")}`);
      else if (filters.period === "quarter") set.add(`${y}-Q${Math.ceil(m / 3)}`);
    });
    return Array.from(set).sort().reverse();
  }, [incidents, filters.period]);

  return (
    <div className="space-y-5 max-w-6xl">
      <div>
        <h1 className="page-title">Intelligence Summary Report</h1>
        <p className="meta-text mt-1">
          Filter the consumer data intelligence dataset, preview the resulting rows, then export or print. Access is role-restricted and audit-logged.
        </p>
      </div>

      {!allowed && (
        <div className="dash-card border-destructive/30 bg-destructive/5 text-sm text-destructive">
          Your current role does not have export permissions. Contact a System Administrator.
        </div>
      )}

      {isLoading ? (
        <PageSkeleton />
      ) : isError ? (
        <ErrorState title="Report data is unavailable" error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          {/* FILTER PANEL */}
          <div className="dash-card space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="section-title flex items-center gap-2">
                <Filter className="h-4 w-4" /> Report Filters
                {activeFilterCount > 0 && (
                  <span className="text-xs font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {activeFilterCount} active
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground tabular-nums">
                  {filtered.length} / {incidents.length} records
                </span>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setFilters(emptyFilters)}>
                    <X className="h-4 w-4 mr-1" /> Clear
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">From date</Label>
                <Input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To date</Label>
                <Input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Period type</Label>
                <Select value={filters.period} onValueChange={(v) => setFilters({ ...filters, period: v as Filters["period"], periodValue: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All time</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="quarter">Quarter</SelectItem>
                    <SelectItem value="year">Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Period value</Label>
                <Select
                  value={filters.periodValue || "any"}
                  onValueChange={(v) => setFilters({ ...filters, periodValue: v === "any" ? "" : v })}
                  disabled={filters.period === "all"}
                >
                  <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    {periodOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Region</Label>
                <Select value={filters.region} onValueChange={(v) => setFilters({ ...filters, region: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All regions</SelectItem>
                    {options.regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">District</Label>
                <Input
                  list="report-districts"
                  placeholder="Any district"
                  value={filters.district}
                  onChange={(e) => setFilters({ ...filters, district: e.target.value })}
                />
                <datalist id="report-districts">
                  {options.districts.map((d) => <option key={d} value={d} />)}
                </datalist>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Incident category</Label>
                <Select value={filters.category} onValueChange={(v) => setFilters({ ...filters, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {options.categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Incident type</Label>
                <Select value={filters.incidentType} onValueChange={(v) => setFilters({ ...filters, incidentType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {options.incidentTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Petroleum product / facility</Label>
                <Select value={filters.productType} onValueChange={(v) => setFilters({ ...filters, productType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All products</SelectItem>
                    {options.productTypes.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Report status</Label>
                <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {options.statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setShowPreview((v) => !v)}>
                <Eye className="h-4 w-4 mr-1" /> {showPreview ? "Hide preview" : "Preview report"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <FileText className="h-4 w-4 mr-1" /> Print
              </Button>
            </div>
          </div>

          {/* PREVIEW */}
          {showPreview && (
            <div className="dash-card">
              <h3 className="section-title mb-3">Report Preview ({filtered.length} rows)</h3>
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No incidents match the current filters.</p>
              ) : (
                <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                  <table className="w-full min-w-[880px] text-sm">
                    <thead className="bg-muted/40 sticky top-0">
                      <tr className="border-b border-border">
                        <th className="data-table-header text-left py-2 px-3">Ref</th>
                        <th className="data-table-header text-left py-2 px-3">Date</th>
                        <th className="data-table-header text-left py-2 px-3">Category</th>
                        <th className="data-table-header text-left py-2 px-3">Type</th>
                        <th className="data-table-header text-left py-2 px-3">Region</th>
                        <th className="data-table-header text-left py-2 px-3">District</th>
                        <th className="data-table-header text-left py-2 px-3">Product</th>
                        <th className="data-table-header text-left py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, 200).map((i: any) => (
                        <tr key={i.id} className="border-b border-border/50">
                          <td className="py-2 px-3 font-mono text-xs">{i.reference_code ?? i.id.slice(0, 8)}</td>
                          <td className="py-2 px-3 text-muted-foreground">{i.incident_date ? new Date(i.incident_date).toLocaleDateString() : "—"}</td>
                          <td className="py-2 px-3">{i.category}</td>
                          <td className="py-2 px-3 text-muted-foreground">{i.incident_type ?? "—"}</td>
                          <td className="py-2 px-3">{i.region}</td>
                          <td className="py-2 px-3 text-muted-foreground">{i.district ?? "—"}</td>
                          <td className="py-2 px-3 text-muted-foreground">{i.product_type ?? "—"}</td>
                          <td className="py-2 px-3">{i.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtered.length > 200 && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Showing first 200 of {filtered.length} rows — full dataset included in export.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="dash-card flex flex-col items-center text-center space-y-3">
              <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center"><FileSpreadsheet className="h-6 w-6 text-success" /></div>
              <h3 className="font-medium text-foreground">Excel Export</h3>
              <p className="meta-text">Genuine Office Open XML workbook with filters and frozen headings</p>
              <Button variant="default" className="w-full" onClick={exportExcel} disabled={!allowed || exporting !== null}>
                {exporting === "XLSX" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />} Export XLSX
              </Button>
            </div>

            <div className="dash-card flex flex-col items-center text-center space-y-3">
              <div className="h-12 w-12 rounded-xl bg-info/10 flex items-center justify-center"><File className="h-6 w-6 text-info" /></div>
              <h3 className="font-medium text-foreground">CSV Export</h3>
              <p className="meta-text">Filtered incident dataset as comma-separated values</p>
              <Button variant="default" className="w-full" onClick={exportCSV} disabled={!allowed || exporting !== null}>
                {exporting === "CSV" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />} Export CSV
              </Button>
            </div>

            <div className="dash-card flex flex-col items-center text-center space-y-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center"><Database className="h-6 w-6 text-primary" /></div>
              <h3 className="font-medium text-foreground">SQL Dump</h3>
              <p className="meta-text">Non-destructive staging-table import with escaped values</p>
              <Button variant="default" className="w-full" onClick={exportSQL} disabled={!allowed || exporting !== null}>
                {exporting === "SQL" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />} Export .sql
              </Button>
            </div>

            <div className="dash-card flex flex-col items-center text-center space-y-3">
              <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center"><FileText className="h-6 w-6 text-destructive" /></div>
              <h3 className="font-medium text-foreground">PDF Report</h3>
              <p className="meta-text">Paginated PDF of the currently filtered rows</p>
              <Button variant="default" className="w-full" onClick={exportPDF} disabled={!allowed || exporting !== null}>
                {exporting === "PDF" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />} Download PDF
              </Button>
            </div>
          </div>
        </>
      )}

      <div className="dash-card">
        <h3 className="section-title mb-4">Export History</h3>
        {historyQuery.isLoading ? <LoadingState label="Loading export history…" className="min-h-36 border-0 shadow-none" /> : historyQuery.isError ? (
          <ErrorState title="Export history is unavailable" error={historyQuery.error} onRetry={() => void historyQuery.refetch()} className="min-h-36 border-0" />
        ) : history.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No exports yet. Generate a report to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/40">
              <tr className="border-b border-border">
                <th className="data-table-header text-left py-2 px-3">File</th>
                <th className="data-table-header text-left py-2 px-3">Format</th>
                <th className="data-table-header text-left py-2 px-3">Rows</th>
                <th className="data-table-header text-left py-2 px-3">Size</th>
                <th className="data-table-header text-left py-2 px-3">By</th>
                <th className="data-table-header text-left py-2 px-3">When</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="py-2 px-3 font-medium">{r.file_name}</td>
                  <td className="py-2 px-3 text-muted-foreground">{r.format}</td>
                  <td className="py-2 px-3 tabular-nums text-muted-foreground">{r.row_count ?? "—"}</td>
                  <td className="py-2 px-3 tabular-nums text-muted-foreground">{formatBytes(r.file_size_bytes)}</td>
                  <td className="py-2 px-3 text-muted-foreground">{r.user_email || "—"}</td>
                  <td className="py-2 px-3 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
