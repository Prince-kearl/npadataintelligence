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

const statusColor: Record<string, string> = {
  New: "bg-info text-info-foreground",
  Reviewed: "bg-warning text-warning-foreground",
  Closed: "bg-success text-success-foreground",
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
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Incident Records</h1>
          <p className="meta-text mt-1">{filtered.length} records found</p>
        </div>
        <Button variant="accent">
          <Download className="h-4 w-4 mr-1" />
          Export Data
        </Button>
      </div>

      {/* Filters */}
      <div className="kpi-card">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by ID, region, category, location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
          <Select>
            <SelectTrigger className="w-40 bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="New">New</SelectItem>
              <SelectItem value="Reviewed">Reviewed</SelectItem>
              <SelectItem value="Closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select>
            <SelectTrigger className="w-40 bg-background">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              <SelectItem value="Greater Accra">Greater Accra</SelectItem>
              <SelectItem value="Western">Western</SelectItem>
              <SelectItem value="Ashanti">Ashanti</SelectItem>
              <SelectItem value="Northern">Northern</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-1" />
            More Filters
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="kpi-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
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
                <tr key={inc.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 font-medium tabular-nums">{inc.id}</td>
                  <td className="py-3 px-4 tabular-nums">{inc.incident_date}</td>
                  <td className="py-3 px-4">{inc.region}</td>
                  <td className="py-3 px-4 max-w-[180px] truncate">{inc.location_name}</td>
                  <td className="py-3 px-4">{inc.category}</td>
                  <td className="py-3 px-4">{inc.incident_type}</td>
                  <td className="py-3 px-4">{inc.product_type}</td>
                  <td className="py-3 px-4 text-right tabular-nums">{inc.casualties}</td>
                  <td className="py-3 px-4 text-right tabular-nums">{inc.fatalities}</td>
                  <td className="py-3 px-4">
                    <Badge className={statusColor[inc.status] || ""} variant="secondary">
                      {inc.status}
                    </Badge>
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
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
