import { Button } from "@/components/ui/button";
import { Download, FileText, FileSpreadsheet, File } from "lucide-react";

export default function Reports() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="page-title">Reports & Export</h1>
        <p className="meta-text mt-1">Generate and export incident data reports.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="kpi-card flex flex-col items-center text-center space-y-3">
          <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
            <FileSpreadsheet className="h-6 w-6 text-success" />
          </div>
          <h3 className="font-medium text-card-foreground">Excel Export</h3>
          <p className="meta-text">Download incident data as .xlsx spreadsheet</p>
          <Button variant="accent" className="w-full">
            <Download className="h-4 w-4 mr-1" />
            Export Excel
          </Button>
        </div>

        <div className="kpi-card flex flex-col items-center text-center space-y-3">
          <div className="h-12 w-12 rounded-lg bg-info/10 flex items-center justify-center">
            <File className="h-6 w-6 text-info" />
          </div>
          <h3 className="font-medium text-card-foreground">CSV Export</h3>
          <p className="meta-text">Download data as comma-separated values</p>
          <Button variant="accent" className="w-full">
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>

        <div className="kpi-card flex flex-col items-center text-center space-y-3">
          <div className="h-12 w-12 rounded-lg bg-destructive/10 flex items-center justify-center">
            <FileText className="h-6 w-6 text-destructive" />
          </div>
          <h3 className="font-medium text-card-foreground">PDF Report</h3>
          <p className="meta-text">Generate formatted summary report</p>
          <Button variant="accent" className="w-full">
            <Download className="h-4 w-4 mr-1" />
            Generate PDF
          </Button>
        </div>
      </div>

      {/* Recent exports */}
      <div className="kpi-card">
        <h3 className="section-title mb-4">Recent Exports</h3>
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No recent exports. Generate a report to get started.</p>
        </div>
      </div>
    </div>
  );
}
