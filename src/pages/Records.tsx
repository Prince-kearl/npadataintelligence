import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Download, Filter, Eye, X, Loader2 } from "lucide-react";
import { useIncidents } from "@/hooks/useIncidents";
import { useRole } from "@/hooks/useRole";
import { useQueryClient } from "@tanstack/react-query";
import { updateIncidentStatus } from "@/lib/incidents";
import { incidentsToCSV, downloadBlob, timestampedName } from "@/lib/exporters";
import { toast } from "sonner";

const statusClass: Record<string, string> = {
  New: "status-new",
  Reviewed: "status-reviewed",
  Closed: "status-closed",
};

export default function Records() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get("category");
  const idFilter = searchParams.get("id");
  const { data: incidents = [], isLoading } = useIncidents();
  const { can } = useRole();
  const qc = useQueryClient();

  const filtered = useMemo(() => {
    return incidents.filter((inc) => {
      if (idFilter && inc.id !== idFilter && inc.reference_code !== idFilter) return false;
      if (categoryFilter && inc.category !== categoryFilter) return false;
      if (statusFilter !== "all" && inc.status !== statusFilter) return false;
      if (regionFilter !== "all" && inc.region !== regionFilter) return false;
      const q = searchTerm.toLowerCase();
      if (!q) return true;
      return (
        (inc.reference_code || "").toLowerCase().includes(q) ||
        inc.region.toLowerCase().includes(q) ||
        inc.category.toLowerCase().includes(q) ||
        inc.location_name.toLowerCase().includes(q)
      );
    });
  }, [incidents, searchTerm, categoryFilter, idFilter, statusFilter, regionFilter]);

  const regions = useMemo(() => Array.from(new Set(incidents.map((i) => i.region))).sort(), [incidents]);

  const clearUrlFilters = () => setSearchParams({});

  const handleStatusChange = async (id: string, status: "New" | "Reviewed" | "Closed") => {
    try {
      await updateIncidentStatus(id, status);
      qc.invalidateQueries({ queryKey: ["incidents"] });
      toast.success(`Status updated to ${status}`);
    } catch (err: any) {
      toast.error(err.message || "Update failed");
    }
  };

  const handleExport = () => {
    const csv = incidentsToCSV(filtered);
    const name = timestampedName("npa_incidents", "csv");
    downloadBlob(name, csv, "text/csv;charset=utf-8");
    toast.success(`Exported ${filtered.length} records`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Incident Records</h1>
          <p className="meta-text mt-1">{isLoading ? "Loading..." : `${filtered.length} records found`}</p>
        </div>
        {can("export_data") && (
          <Button variant="default" onClick={handleExport} disabled={!filtered.length}>
            <Download className="h-4 w-4 mr-1" /> Export Data
          </Button>
        )}
      </div>

      {(categoryFilter || idFilter) && (
        <div className="flex items-center gap-2 flex-wrap">
          {categoryFilter && (
            <Badge variant="secondary" className="bg-accent/10 text-accent border border-accent/20 gap-1.5 pl-2.5">
              Category: {categoryFilter}
              <button onClick={clearUrlFilters} className="hover:bg-accent/20 rounded p-0.5"><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {idFilter && (
            <Badge variant="secondary" className="bg-accent/10 text-accent border border-accent/20 gap-1.5 pl-2.5">
              ID: {idFilter}
              <button onClick={clearUrlFilters} className="hover:bg-accent/20 rounded p-0.5"><X className="h-3 w-3" /></button>
            </Badge>
          )}
        </div>
      )}

      <div className="dash-card">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by reference, region, category, location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-muted/50 border-border rounded-lg"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 bg-muted/50 border-border rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="New">New</SelectItem>
              <SelectItem value="Reviewed">Reviewed</SelectItem>
              <SelectItem value="Closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger className="w-40 bg-muted/50 border-border rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All Regions</SelectItem>
              {regions.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
            </SelectContent>
          </Select>
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
                  <th className="data-table-header text-left py-3 px-4">Type</th>
                  <th className="data-table-header text-left py-3 px-4">Product</th>
                  <th className="data-table-header text-right py-3 px-4">Cas.</th>
                  <th className="data-table-header text-right py-3 px-4">Fat.</th>
                  <th className="data-table-header text-left py-3 px-4">Status</th>
                  {can("edit_records") && <th className="data-table-header text-left py-3 px-4">Actions</th>}
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
                    <td className="py-3 px-4 text-muted-foreground">{inc.incident_type}</td>
                    <td className="py-3 px-4 text-muted-foreground">{inc.product_type}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">{inc.casualties}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">{inc.fatalities}</td>
                    <td className="py-3 px-4">
                      <Badge className={statusClass[inc.status] || ""} variant="secondary">{inc.status}</Badge>
                    </td>
                    {can("edit_records") && (
                      <td className="py-3 px-4">
                        <Select value={inc.status} onValueChange={(v) => handleStatusChange(inc.id, v as any)}>
                          <SelectTrigger className="h-8 w-28 text-xs bg-muted/50 border-border rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="New">New</SelectItem>
                            <SelectItem value="Reviewed">Reviewed</SelectItem>
                            <SelectItem value="Closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    )}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={11} className="text-center py-10 text-sm text-muted-foreground">
                      No records match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
