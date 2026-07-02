import { Button } from "@/components/ui/button";
import { Download, FileText, FileSpreadsheet, File, Database, Loader2 } from "lucide-react";
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
import { useState } from "react";
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

export default function Reports() {
  const { can } = useRole();
  const allowed = can("export_data");
  const incidentsQuery = useIncidents();
  const { data: incidents = [], isLoading, isError, error, refetch } = incidentsQuery;
  const qc = useQueryClient();
  const historyQuery = useQuery({ queryKey: ["export-history"], queryFn: fetchExportHistory });
  const { data: history = [] } = historyQuery;
  const [exporting, setExporting] = useState<string | null>(null);

  const recordExport = async (name: string, format: string, size: number) => {
    await logExportRow({ file_name: name, format, row_count: incidents.length, file_size_bytes: size });
    await qc.invalidateQueries({ queryKey: ["export-history"] });
  };

  const guard = () => {
    if (!allowed) { toast.error("Your role does not have permission to export data."); return false; }
    if (!incidents.length) { toast.error("No incident data available to export."); return false; }
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
        toast.success(`${format} downloaded · ${formatBytes(blob.size)}`);
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
    const name = timestampedName("npa_incidents", "csv");
    return runExport("CSV", name, () => new Blob([incidentsToCSV(incidents)], { type: "text/csv;charset=utf-8" }));
  };

  const exportExcel = async () => {
    const name = timestampedName("npa_incidents", "xlsx");
    return runExport("XLSX", name, () => incidentsToXLSX(incidents));
  };

  const exportSQL = async () => {
    const name = timestampedName("npa_incidents", "sql");
    return runExport("SQL", name, () => new Blob([incidentsToSQLDump(incidents)], { type: "application/sql;charset=utf-8" }));
  };

  const exportPDF = async () => {
    const name = timestampedName("npa_report", "pdf");
    return runExport("PDF", name, () => incidentsToPDF(incidents));
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="page-title">Reports & Data Export</h1>
        <p className="meta-text mt-1">
          Centralized SQL repository — export incident datasets in standard formats. Access is role-restricted and audit-logged.
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
            <p className="meta-text">Full incident dataset as comma-separated values</p>
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
            <p className="meta-text">Genuine paginated PDF downloaded directly to your device</p>
            <Button variant="default" className="w-full" onClick={exportPDF} disabled={!allowed || exporting !== null}>
              {exporting === "PDF" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />} Download PDF
            </Button>
          </div>
        </div>
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
