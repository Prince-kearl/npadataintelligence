import { useState } from "react";
import { mockIncidents } from "@/lib/mock-data";
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
import { Search, Download, Filter, Eye } from "lucide-react";

const statusClass: Record<string, string> = {
  New: "status-new",
  Reviewed: "status-reviewed",
  Closed: "status-closed",
};

export default function Records() {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = mockIncidents.filter(
    (inc) =>
      inc.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.region.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.location_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Incident Records</h1>
          <p className="meta-text mt-1">{filtered.length} records found</p>
        </div>
        <Button variant="default">
          <Download className="h-4 w-4 mr-1" />
          Export Data
        </Button>
      </div>

      {/* Filters */}
      <div className="dash-card">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by ID, region, category, location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-muted/50 border-border rounded-lg"
            />
          </div>
          <Select>
            <SelectTrigger className="w-36 bg-muted/50 border-border rounded-lg">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="New">New</SelectItem>
              <SelectItem value="Reviewed">Reviewed</SelectItem>
              <SelectItem value="Closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select>
            <SelectTrigger className="w-36 bg-muted/50 border-border rounded-lg">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All Regions</SelectItem>
              <SelectItem value="Greater Accra">Greater Accra</SelectItem>
              <SelectItem value="Western">Western</SelectItem>
              <SelectItem value="Ashanti">Ashanti</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-1" />
            More Filters
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="dash-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b border-border">
                <th className="data-table-header text-left py-3 px-4">ID</th>
                <th className="data-table-header text-left py-3 px-4">Date</th>
                <th className="data-table-header text-left py-3 px-4">Region</th>
                <th className="data-table-header text-left py-3 px-4">Location</th>
                <th className="data-table-header text-left py-3 px-4">Category</th>
                <th className="data-table-header text-left py-3 px-4">Type</th>
                <th className="data-table-header text-left py-3 px-4">Product</th>
                <th className="data-table-header text-right py-3 px-4">Casualties</th>
                <th className="data-table-header text-right py-3 px-4">Fatalities</th>
                <th className="data-table-header text-left py-3 px-4">Status</th>
                <th className="data-table-header text-left py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inc) => (
                <tr key={inc.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 font-medium tabular-nums text-foreground">{inc.id}</td>
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
                  <td className="py-3 px-4">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="meta-text">Showing {filtered.length} of {mockIncidents.length} records</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>Previous</Button>
            <Button variant="outline" size="sm" disabled>Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
