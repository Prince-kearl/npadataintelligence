import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
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

const REQUIRED_KEYS: (keyof ImportedIncident)[] = ["incidentDate", "region", "locationName", "category", "description"];

function missingFields(row: ImportedIncident): string[] {
  const missing: string[] = [];
  if (!row.incidentDate) missing.push("Date");
  if (!row.region) missing.push("Region");
  if (!row.locationName) missing.push("Location");
  if (!row.category) missing.push("Category");
  if (!row.description) missing.push("Description");
  return missing;
}

export default function BulkImportReviewDialog({ open, onOpenChange, rows, busy = false, onSubmit }: Props) {
  const [items, setItems] = useState<ImportedIncident[]>(rows);

  useEffect(() => {
    if (open) setItems(rows);
  }, [open, rows]);

  const update = (idx: number, patch: Partial<ImportedIncident>) =>
    setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const remove = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const validCount = useMemo(() => items.filter((r) => missingFields(r).length === 0).length, [items]);
  const invalidCount = items.length - validCount;

  const submit = async () => {
    const ready = items.filter((r) => missingFields(r).length === 0);
    if (!ready.length) {
      toast.error("No complete records to submit.", {
        description: "Fill the highlighted required fields on at least one row before submitting.",
      });
      return;
    }
    await onSubmit(ready);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Review incidents before saving</DialogTitle>
          <DialogDescription>
            Each row below will be saved as its own incident record. Expand a row to complete missing fields.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 flex-wrap text-sm">
          <Badge variant="secondary" className="bg-success/10 text-success border border-success/20 gap-1">
            <CheckCircle2 className="h-3 w-3" /> {validCount} ready
          </Badge>
          {invalidCount > 0 && (
            <Badge variant="secondary" className="bg-warning/10 text-warning border border-warning/20 gap-1">
              <AlertCircle className="h-3 w-3" /> {invalidCount} need attention
            </Badge>
          )}
          <span className="text-muted-foreground text-xs ml-auto">
            Required: Date, Region, Location, Category, Description
          </span>
        </div>

        <ScrollArea className="flex-1 -mx-1 pr-1 max-h-[60vh]">
          <Accordion type="multiple" className="space-y-2 px-1">
            {items.map((row, idx) => {
              const missing = missingFields(row);
              const isValid = missing.length === 0;
              return (
                <AccordionItem
                  key={idx}
                  value={String(idx)}
                  className={`border rounded-lg px-3 ${isValid ? "border-border" : "border-warning/40 bg-warning/5"}`}
                >
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-3 w-full min-w-0 text-left">
                      <span className="text-xs font-mono text-muted-foreground w-6 shrink-0">#{idx + 1}</span>
                      <span className="text-sm font-medium truncate min-w-0 flex-1">
                        {row.locationName || <span className="italic text-muted-foreground">No location</span>}
                        {row.region ? ` · ${row.region}` : ""}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
                        {row.incidentDate || "no date"}
                      </span>
                      {isValid ? (
                        <Badge variant="secondary" className="bg-success/10 text-success border border-success/20 shrink-0">Ready</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-warning/10 text-warning border border-warning/20 shrink-0">
                          Missing: {missing.join(", ")}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Incident Date *" required={!row.incidentDate}>
                        <Input type="date" value={row.incidentDate ?? ""} onChange={(e) => update(idx, { incidentDate: e.target.value })} />
                      </Field>
                      <Field label="Region *" required={!row.region}>
                        <SelectField value={row.region} options={REGIONS} onChange={(v) => update(idx, { region: v })} />
                      </Field>
                      <Field label="District">
                        <Input value={row.district ?? ""} onChange={(e) => update(idx, { district: e.target.value })} />
                      </Field>
                      <Field label="Location / Facility *" required={!row.locationName}>
                        <Input value={row.locationName ?? ""} onChange={(e) => update(idx, { locationName: e.target.value })} />
                      </Field>
                      <Field label="GPS Coordinates">
                        <Input value={row.gps ?? ""} onChange={(e) => update(idx, { gps: e.target.value })} placeholder="lat, lon" />
                      </Field>
                      <Field label="Category *" required={!row.category}>
                        <SelectField value={row.category} options={INCIDENT_CATEGORIES} onChange={(v) => update(idx, { category: v })} />
                      </Field>
                      <Field label="Incident Type">
                        <SelectField value={row.incidentType} options={INCIDENT_TYPES} onChange={(v) => update(idx, { incidentType: v })} />
                      </Field>
                      <Field label="Product Type">
                        <SelectField value={row.productType} options={PRODUCT_TYPES} onChange={(v) => update(idx, { productType: v })} />
                      </Field>
                      <Field label="Injury Type">
                        <SelectField value={row.injuryType} options={INJURY_TYPES} onChange={(v) => update(idx, { injuryType: v })} />
                      </Field>
                      <Field label="Report Source">
                        <SelectField value={row.source} options={REPORT_SOURCES} onChange={(v) => update(idx, { source: v })} />
                      </Field>
                      <Field label="Casualties (injured)">
                        <Input type="number" min={0} value={row.casualties ?? 0} onChange={(e) => update(idx, { casualties: parseInt(e.target.value, 10) || 0 })} />
                      </Field>
                      <Field label="Fatalities (deaths)">
                        <Input type="number" min={0} value={row.fatalities ?? 0} onChange={(e) => update(idx, { fatalities: parseInt(e.target.value, 10) || 0 })} />
                      </Field>
                      <div className="sm:col-span-2">
                        <Field label="Description *" required={!row.description}>
                          <Textarea rows={3} value={row.description ?? ""} onChange={(e) => update(idx, { description: e.target.value })} />
                        </Field>
                      </div>
                    </div>
                    <div className="flex justify-end mt-3">
                      <Button type="button" variant="ghost" size="sm" onClick={() => remove(idx)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4 mr-1" /> Remove row
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={busy || validCount === 0}>
            {busy ? "Saving…" : `Save ${validCount} record${validCount === 1 ? "" : "s"} to database`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className={`text-xs ${required ? "text-destructive" : "text-muted-foreground"}`}>{label}</Label>
      {children}
    </div>
  );
}

function SelectField<T extends string>({ value, options, onChange }: { value?: string; options: readonly T[]; onChange: (v: string) => void }) {
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger className="h-9"><SelectValue placeholder="Select…" /></SelectTrigger>
      <SelectContent>
        {options.map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
      </SelectContent>
    </Select>
  );
}
