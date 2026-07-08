import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Trash2, Table as TableIcon } from "lucide-react";
import { toast } from "sonner";
import type { ImportedIncident } from "@/components/ExcelImportDialog";
import { REGIONS, INCIDENT_CATEGORIES, INCIDENT_TYPES, PRODUCT_TYPES, INJURY_TYPES, REPORT_SOURCES } from "@/lib/incident-options";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: ImportedIncident[];
  busy?: boolean;
  onSubmit: (finalRows: ImportedIncident[]) => void | Promise<void>;
}

type Row = ImportedIncident;

function missingFields(row: Row): string[] {
  const missing: string[] = [];
  if (!row.incidentDate) missing.push("Date");
  if (!row.region) missing.push("Region");
  if (!row.locationName) missing.push("Location");
  if (!row.category) missing.push("Category");
  if (!row.description) missing.push("Description");
  return missing;
}

// Spreadsheet-style column configuration
type ColKey =
  | "incidentDate" | "region" | "district" | "locationName" | "gps"
  | "category" | "incidentType" | "productType" | "injuryType"
  | "casualties" | "fatalities" | "source" | "description";

const COLUMNS: Array<{
  key: ColKey;
  label: string;
  required?: boolean;
  type: "text" | "date" | "number" | "select";
  options?: readonly string[];
  width: string;
}> = [
  { key: "incidentDate", label: "Date *",        required: true, type: "date",   width: "w-36" },
  { key: "region",       label: "Region *",      required: true, type: "select", options: REGIONS, width: "w-40" },
  { key: "district",     label: "District",                       type: "text",   width: "w-36" },
  { key: "locationName", label: "Location *",    required: true, type: "text",   width: "w-40" },
  { key: "gps",          label: "GPS",                            type: "text",   width: "w-36" },
  { key: "category",     label: "Category *",    required: true, type: "select", options: INCIDENT_CATEGORIES, width: "w-40" },
  { key: "incidentType", label: "Type",                           type: "select", options: INCIDENT_TYPES,      width: "w-32" },
  { key: "productType",  label: "Product",                        type: "select", options: PRODUCT_TYPES,       width: "w-40" },
  { key: "injuryType",   label: "Injury",                         type: "select", options: INJURY_TYPES,        width: "w-36" },
  { key: "casualties",   label: "Cas.",                           type: "number", width: "w-20" },
  { key: "fatalities",   label: "Fat.",                           type: "number", width: "w-20" },
  { key: "source",       label: "Source",                         type: "select", options: REPORT_SOURCES,      width: "w-40" },
  { key: "description",  label: "Description *", required: true, type: "text",   width: "w-72" },
];

export default function BulkImportReviewDialog({ open, onOpenChange, rows, busy = false, onSubmit }: Props) {
  const [items, setItems] = useState<Row[]>(rows);

  useEffect(() => { if (open) setItems(rows); }, [open, rows]);

  const update = (idx: number, key: ColKey, value: string) => {
    setItems((prev) => prev.map((r, i) => {
      if (i !== idx) return r;
      if (key === "casualties" || key === "fatalities") {
        return { ...r, [key]: parseInt(value, 10) || 0 };
      }
      return { ...r, [key]: value };
    }));
  };

  const remove = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const validCount = useMemo(() => items.filter((r) => missingFields(r).length === 0).length, [items]);
  const invalidCount = items.length - validCount;

  const submit = async () => {
    const ready = items.filter((r) => missingFields(r).length === 0);
    if (!ready.length) {
      toast.error("No complete records to commit.", {
        description: "Fill the red-highlighted cells on at least one row before committing.",
      });
      return;
    }
    if (invalidCount > 0) {
      toast.warning(`${invalidCount} incomplete row${invalidCount === 1 ? "" : "s"} will be skipped`, {
        description: "Complete or remove them to include in the batch.",
      });
    }
    await onSubmit(ready);
  };

  const isCellInvalid = (row: Row, key: ColKey): boolean => {
    const col = COLUMNS.find((c) => c.key === key);
    if (!col?.required) return false;
    const v = (row as any)[key];
    return !v || (typeof v === "string" && !v.trim());
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-[98vw] w-[98vw] max-h-[95vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TableIcon className="h-5 w-5" /> Bulk Ingestion — Staging Grid
          </DialogTitle>
          <DialogDescription>
            Edit any cell directly. Red-highlighted cells are required. Remove rows you don't want to commit.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 flex-wrap text-sm">
          <Badge variant="secondary" className="bg-success/10 text-success border border-success/20 gap-1">
            <CheckCircle2 className="h-3 w-3" /> {validCount} ready
          </Badge>
          {invalidCount > 0 && (
            <Badge variant="secondary" className="bg-destructive/10 text-destructive border border-destructive/20 gap-1">
              <AlertCircle className="h-3 w-3" /> {invalidCount} incomplete
            </Badge>
          )}
          <span className="text-muted-foreground text-xs ml-auto">
            {items.length} total row{items.length === 1 ? "" : "s"} in staging
          </span>
        </div>

        <div className="flex-1 overflow-auto border rounded-lg bg-card">
          <table className="text-sm border-collapse w-max min-w-full">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r sticky left-0 bg-muted z-20 w-12">#</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} className={`px-2 py-2 text-left text-xs font-semibold border-b border-r ${c.width}`}>
                    {c.label}
                  </th>
                ))}
                <th className="px-2 py-2 text-center text-xs font-semibold border-b w-14">Del</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, idx) => {
                const rowInvalid = missingFields(row).length > 0;
                return (
                  <tr key={idx} className={rowInvalid ? "bg-destructive/5" : "hover:bg-muted/40"}>
                    <td className="px-2 py-1 border-b border-r text-xs font-mono text-muted-foreground sticky left-0 bg-inherit">
                      {idx + 1}
                    </td>
                    {COLUMNS.map((c) => {
                      const invalid = isCellInvalid(row, c.key);
                      const value = (row as any)[c.key] ?? "";
                      const cellCls = `border-b border-r p-0 ${invalid ? "bg-destructive/15 ring-1 ring-inset ring-destructive/40" : ""}`;
                      if (c.type === "select") {
                        return (
                          <td key={c.key} className={cellCls}>
                            <select
                              value={value}
                              onChange={(e) => update(idx, c.key, e.target.value)}
                              className="w-full h-8 px-2 bg-transparent text-sm border-0 outline-none focus:ring-2 focus:ring-primary/40"
                            >
                              <option value="">—</option>
                              {c.options!.map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          </td>
                        );
                      }
                      return (
                        <td key={c.key} className={cellCls}>
                          <Input
                            type={c.type}
                            value={value}
                            onChange={(e) => update(idx, c.key, e.target.value)}
                            className="h-8 rounded-none border-0 bg-transparent focus-visible:ring-2 focus-visible:ring-primary/40 shadow-none text-sm"
                          />
                        </td>
                      );
                    })}
                    <td className="border-b text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(idx)}
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 2} className="py-8 text-center text-muted-foreground text-sm">
                    No rows in staging. Close and re-upload a spreadsheet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={busy || validCount === 0}>
            {busy ? "Committing…" : `Commit Batch to Records (${validCount})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
