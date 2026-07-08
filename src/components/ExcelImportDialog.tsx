import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import { toast } from "sonner";

const NONE = "__none__";

export interface ImportedIncident {
  incidentDate?: string;
  region?: string;
  district?: string;
  locationName?: string;
  gps?: string;
  category?: string;
  incidentType?: string;
  productType?: string;
  injuryType?: string;
  casualties?: number;
  fatalities?: number;
  description?: string;
  source?: string;
}

interface SystemField {
  key: keyof ImportedIncident;
  label: string;
  hints: string[]; // lowercase keyword hints for fuzzy matching
  type: "string" | "number" | "date";
}

const SYSTEM_FIELDS: SystemField[] = [
  { key: "incidentDate", label: "Incident Date", hints: ["date", "incident date", "occurred", "day"], type: "date" },
  { key: "region", label: "Region", hints: ["region", "regions", "state", "province"], type: "string" },
  { key: "district", label: "District", hints: ["district", "municipal", "county"], type: "string" },
  { key: "locationName", label: "Location / Facility", hints: ["location", "facility", "site", "place", "address"], type: "string" },
  { key: "gps", label: "GPS Coordinates", hints: ["gps", "coordinates", "lat", "long", "geo"], type: "string" },
  { key: "category", label: "Incident Category", hints: ["incident", "category", "type of incident", "event"], type: "string" },
  { key: "incidentType", label: "Incident Type (severity)", hints: ["severity", "incident type", "classification"], type: "string" },
  { key: "productType", label: "Product Type", hints: ["product", "fuel", "commodity"], type: "string" },
  { key: "injuryType", label: "Injury Type", hints: ["injury", "injuries", "harm"], type: "string" },
  { key: "casualties", label: "Casualties (injured)", hints: ["casualt", "injured", "injuries", "hurt"], type: "number" },
  { key: "fatalities", label: "Fatalities (deaths)", hints: ["fatalit", "death", "deaths", "killed"], type: "number" },
  { key: "description", label: "Description", hints: ["description", "brief", "narrative", "summary", "details", "remarks"], type: "string" },
  { key: "source", label: "Report Source", hints: ["source", "reported by", "channel", "control mechanism"], type: "string" },
];

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreMatch(header: string, hints: string[]): number {
  const h = normalize(header);
  if (!h || h.startsWith("empty")) return 0;
  let best = 0;
  for (const hint of hints) {
    const n = normalize(hint);
    if (!n) continue;
    if (h === n) best = Math.max(best, 100);
    else if (h.includes(n) || n.includes(h)) best = Math.max(best, 70);
    else {
      const tokens = n.split(" ");
      const hits = tokens.filter((t) => t.length > 2 && h.includes(t)).length;
      if (hits > 0) best = Math.max(best, 40 + hits * 5);
    }
  }
  return best;
}

function excelSerialToISO(n: number): string | undefined {
  // Excel serial date -> JS date. 25569 = 1970-01-01, 86400 seconds/day.
  if (!isFinite(n) || n <= 0) return undefined;
  const utcMs = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(utcMs);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

function parseDateFlexible(raw: unknown): string | undefined {
  if (raw == null || raw === "") return undefined;
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw.toISOString().slice(0, 10);
  if (typeof raw === "number") return excelSerialToISO(raw);
  const s = String(raw).trim();
  if (!s) return undefined;
  // ISO already
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // DD/MM/YYYY or MM/DD/YYYY or with '-' or '.'
  const parts = s.split(/[\/\-.]/).map((p) => p.trim());
  if (parts.length === 3) {
    let [a, b, c] = parts;
    if (c.length === 2) c = "20" + c;
    const dd = parseInt(a, 10);
    const mm = parseInt(b, 10);
    const yyyy = parseInt(c, 10);
    // Assume DD/MM/YYYY (common outside US); flip if impossible
    let day = dd, month = mm;
    if (mm > 12 && dd <= 12) { day = mm; month = dd; }
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && yyyy > 1900) {
      return `${yyyy}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const t = Date.parse(s);
  if (!isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return undefined;
}

function parseNumberSafe(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  if (typeof raw === "number") return Math.max(0, Math.round(raw));
  const cleaned = String(raw).replace(/[^0-9.\-]/g, "");
  const n = parseInt(cleaned, 10);
  return isFinite(n) ? Math.max(0, n) : 0;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "single" | "bulk";
  onApply?: (data: ImportedIncident) => void;
  onBulkApply?: (rows: ImportedIncident[]) => void | Promise<void>;
  busy?: boolean;
}

export default function ExcelImportDialog({ open, onOpenChange, mode = "single", onApply, onBulkApply, busy = false }: Props) {
  const [progress, setProgress] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [rowIndex, setRowIndex] = useState(0);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setProgress(0);
    setParsing(false);
    setFileName("");
    setHeaders([]);
    setRows([]);
    setRowIndex(0);
    setMapping({});
    if (inputRef.current) inputRef.current.value = "";
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  const handleFile = async (file: File) => {
    const ext = file.name.toLowerCase().split(".").pop();
    if (!ext || !["xlsx", "xls"].includes(ext)) {
      toast.error("Only .xlsx or .xls spreadsheets are supported.");
      return;
    }
    setFileName(file.name);
    setParsing(true);
    setProgress(5);
    try {
      const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.min(60, Math.round((e.loaded / e.total) * 60)));
        };
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
      });
      setProgress(70);
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) throw new Error("empty");
      const ws = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: true });
      setProgress(90);
      // Keep rows that have real data in at least 2 named columns — this drops
      // section-header rows like "FIRST QUARTER" that only fill a single cell.
      const isNamed = (k: string) => !k.startsWith("__EMPTY");
      const namedValueCount = (r: Record<string, unknown>) =>
        Object.entries(r).filter(([k, v]) => isNamed(k) && v != null && String(v).trim() !== "").length;
      const cleaned = json.filter((r) => namedValueCount(r) >= 2);
      if (!cleaned.length) throw new Error("empty");
      const detectedHeaders = Array.from(
        new Set(cleaned.flatMap((r) => Object.keys(r)))
      ).filter(isNamed);
      if (!detectedHeaders.length) throw new Error("empty");

      // Fuzzy pre-mapping
      const initial: Record<string, string> = {};
      for (const field of SYSTEM_FIELDS) {
        let bestHeader = "";
        let bestScore = 0;
        for (const h of detectedHeaders) {
          const s = scoreMatch(h, [field.label, ...field.hints]);
          if (s > bestScore) { bestScore = s; bestHeader = h; }
        }
        initial[field.key] = bestScore >= 40 ? bestHeader : NONE;
      }
      // Pick the first row that actually has values in the auto-mapped columns.
      const mappedCols = Object.values(initial).filter((c) => c && c !== NONE);
      const firstUsableIdx = cleaned.findIndex((r) =>
        mappedCols.some((c) => r[c] != null && String(r[c]).trim() !== "")
      );
      setHeaders(detectedHeaders);
      setRows(cleaned);
      setRowIndex(firstUsableIdx >= 0 ? firstUsableIdx : 0);
      setMapping(initial);
      setProgress(100);
    } catch {
      reset();
      toast.error("Unable to parse spreadsheet headers. Please ensure the file is unprotected and has a valid top header row.");
    } finally {
      setParsing(false);
    }
  };

  const previewRows = useMemo(() => rows.slice(0, 25), [rows]);

  const extractRow = (row: Record<string, unknown>): ImportedIncident => {
    const out: ImportedIncident = {};
    for (const field of SYSTEM_FIELDS) {
      const col = mapping[field.key];
      if (!col || col === NONE) continue;
      const raw = row[col];
      if (raw == null || String(raw).trim() === "") continue;
      if (field.type === "date") {
        const v = parseDateFlexible(raw);
        if (v) (out as any)[field.key] = v;
      } else if (field.type === "number") {
        (out as any)[field.key] = parseNumberSafe(raw);
      } else {
        (out as any)[field.key] = String(raw).trim();
      }
    }
    return out;
  };

  const apply = async () => {
    if (mode === "bulk") {
      const all = rows.map(extractRow);
      await onBulkApply?.(all);
      return;
    }
    const row = rows[rowIndex];
    if (!row) return;
    const out = extractRow(row);
    onApply?.(out);
    onOpenChange(false);
    const filled = Object.keys(out).length;
    const skipped = SYSTEM_FIELDS.length - filled;
    toast.success(`Filled ${filled} field${filled === 1 ? "" : "s"} from row ${rowIndex + 1}`, {
      description: skipped > 0
        ? `${skipped} unmapped field${skipped === 1 ? "" : "s"} left blank — complete them manually before submitting.`
        : "Review the form and submit when ready.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" /> Import Data via Excel
          </DialogTitle>
          <DialogDescription>
            {mode === "bulk"
              ? "Upload an .xlsx or .xls file — every row will be imported as an incident record after you confirm the column mapping."
              : "Upload an .xlsx or .xls file. We'll detect the columns and let you map them to the form fields."}
          </DialogDescription>
        </DialogHeader>

        {!headers.length ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            className="border-2 border-dashed border-border rounded-xl p-8 text-center bg-muted/30"
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-foreground font-medium">Drop your spreadsheet here</p>
            <p className="text-xs text-muted-foreground mb-4">Accepted formats: .xlsx, .xls</p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Button type="button" onClick={() => inputRef.current?.click()} disabled={parsing}>
              {parsing ? "Reading…" : "Choose file"}
            </Button>
            {parsing && (
              <div className="mt-4 space-y-1">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">{fileName} — {progress}%</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium truncate">{fileName}</span>
                <Badge variant="secondary">{rows.length} row{rows.length === 1 ? "" : "s"}</Badge>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                <X className="h-4 w-4 mr-1" /> Choose another
              </Button>
            </div>

            {mode === "single" && rows.length > 1 && (
              <div className="space-y-2">
                <Label className="label-text">Select the row to import</Label>
                <div className="border rounded-lg overflow-auto max-h-56">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/60 sticky top-0">
                      <tr>
                        <th className="p-2 text-left">#</th>
                        {headers.slice(0, 5).map((h) => (
                          <th key={h} className="p-2 text-left whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((r, i) => (
                        <tr
                          key={i}
                          onClick={() => setRowIndex(i)}
                          className={`cursor-pointer border-t ${i === rowIndex ? "bg-primary/10" : "hover:bg-muted/40"}`}
                        >
                          <td className="p-2 font-medium">{i + 1}</td>
                          {headers.slice(0, 5).map((h) => (
                            <td key={h} className="p-2 whitespace-nowrap max-w-[180px] truncate">
                              {r[h] == null ? "" : String(r[h])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label className="label-text">Map spreadsheet columns to form fields</Label>
                <p className="text-xs text-muted-foreground">
                  {mode === "bulk"
                    ? `All ${rows.length} row${rows.length === 1 ? "" : "s"} will be imported. Unmapped fields are saved blank.`
                    : "Fields left as Not mapped stay blank so you can fill them in manually."}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SYSTEM_FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{f.label}</Label>
                    <Select
                      value={mapping[f.key] ?? NONE}
                      onValueChange={(v) => setMapping((m) => ({ ...m, [f.key]: v }))}
                    >
                      <SelectTrigger className="bg-muted/40 h-10">
                        <SelectValue placeholder="Not mapped" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— Not mapped —</SelectItem>
                        {headers.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button type="button" onClick={apply} disabled={!headers.length || !rows.length || busy}>
            {busy
              ? "Importing…"
              : mode === "bulk"
                ? `Import ${rows.length} record${rows.length === 1 ? "" : "s"}`
                : "Apply Mapping"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
