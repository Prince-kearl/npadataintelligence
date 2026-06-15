import { Button } from "@/components/ui/button";
import { Download, FileText, FileSpreadsheet, File, Database, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  incidentsToCSV,
  incidentsToSQLDump,
  downloadBlob,
  timestampedName,
} from "@/lib/exporters";
import { useRole } from "@/hooks/useRole";
import { useIncidents } from "@/hooks/useIncidents";

interface ExportRecord { name: string; format: string; size: string; at: string; }

export default function Reports() {
  const { can } = useRole();
  const allowed = can("export_data");
  const { data: incidents = [], isLoading } = useIncidents();
  const [recent, setRecent] = useState<ExportRecord[]>([]);

  const logExport = (name: string, format: string, content: string) => {
    setRecent((r) =>
      [{ name, format, size: `${(content.length / 1024).toFixed(1)} KB`, at: new Date().toLocaleString() }, ...r].slice(0, 8)
    );
  };

  const guard = () => {
    if (!allowed) { toast.error("Your role does not have permission to export data."); return false; }
    if (!incidents.length) { toast.error("No incident data available to export."); return false; }
    return true;
  };

  const exportCSV = () => {
    if (!guard()) return;
    const content = incidentsToCSV(incidents);
    const name = timestampedName("npa_incidents", "csv");
    downloadBlob(name, content, "text/csv;charset=utf-8");
    logExport(name, "CSV", content);
    toast.success(`Exported ${incidents.length} records as CSV`);
  };

  const exportExcel = () => {
    if (!guard()) return;
    const content = incidentsToCSV(incidents);
    const name = timestampedName("npa_incidents", "xls");
    downloadBlob(name, content, "application/vnd.ms-excel");
    logExport(name, "Excel", content);
    toast.success("Excel export ready");
  };

  const exportSQL = () => {
    if (!guard()) return;
    const content = incidentsToSQLDump(incidents);
    const name = timestampedName("npa_incidents", "sql");
    downloadBlob(name, content, "application/sql");
    logExport(name, "SQL Dump", content);
    toast.success("SQL dump generated");
  };

  const exportPDF = () => {
    if (!guard()) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const rows = incidents
      .map((i) => `<tr><td>${i.reference_code}</td><td>${i.incident_date}</td><td>${i.region}</td><td>${i.category}</td><td>${i.status}</td></tr>`)
      .join("");
    win.document.write(`<html><head><title>NPA Incident Report</title>
      <style>body{font-family:Arial;padding:24px}h1{color:#1B2F6B}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px}th{background:#1B2F6B;color:white}</style>
      </head><body><h1>NPA Incident Summary Report</h1><p>Generated ${new Date().toLocaleString()} · ${incidents.length} records</p>
      <table><thead><tr><th>Reference</th><th>Date</th><th>Region</th><th>Category</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
      <script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
    logExport(timestampedName("npa_report", "pdf"), "PDF", "0");
    toast.success("PDF print view opened");
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
        <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="dash-card flex flex-col items-center text-center space-y-3">
            <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center"><FileSpreadsheet className="h-6 w-6 text-success" /></div>
            <h3 className="font-medium text-foreground">Excel Export</h3>
            <p className="meta-text">Open-ready .xls spreadsheet of all incidents</p>
            <Button variant="default" className="w-full" onClick={exportExcel} disabled={!allowed}>
              <Download className="h-4 w-4 mr-1" /> Export Excel
            </Button>
          </div>

          <div className="dash-card flex flex-col items-center text-center space-y-3">
            <div className="h-12 w-12 rounded-xl bg-info/10 flex items-center justify-center"><File className="h-6 w-6 text-info" /></div>
            <h3 className="font-medium text-foreground">CSV Export</h3>
            <p className="meta-text">Full incident dataset as comma-separated values</p>
            <Button variant="default" className="w-full" onClick={exportCSV} disabled={!allowed}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          </div>

          <div className="dash-card flex flex-col items-center text-center space-y-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center"><Database className="h-6 w-6 text-primary" /></div>
            <h3 className="font-medium text-foreground">SQL Dump</h3>
            <p className="meta-text">Schema + INSERT statements for backup / migration</p>
            <Button variant="default" className="w-full" onClick={exportSQL} disabled={!allowed}>
              <Download className="h-4 w-4 mr-1" /> Export .sql
            </Button>
          </div>

          <div className="dash-card flex flex-col items-center text-center space-y-3">
            <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center"><FileText className="h-6 w-6 text-destructive" /></div>
            <h3 className="font-medium text-foreground">PDF Report</h3>
            <p className="meta-text">NPA-branded printable summary report</p>
            <Button variant="default" className="w-full" onClick={exportPDF} disabled={!allowed}>
              <Download className="h-4 w-4 mr-1" /> Generate PDF
            </Button>
          </div>
        </div>
      )}

      <div className="dash-card">
        <h3 className="section-title mb-4">Recent Exports</h3>
        {recent.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No recent exports. Generate a report to get started.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="border-b border-border">
                <th className="data-table-header text-left py-2 px-3">File</th>
                <th className="data-table-header text-left py-2 px-3">Format</th>
                <th className="data-table-header text-left py-2 px-3">Size</th>
                <th className="data-table-header text-left py-2 px-3">Generated</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2 px-3 font-medium">{r.name}</td>
                  <td className="py-2 px-3 text-muted-foreground">{r.format}</td>
                  <td className="py-2 px-3 tabular-nums text-muted-foreground">{r.size}</td>
                  <td className="py-2 px-3 text-muted-foreground">{r.at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
