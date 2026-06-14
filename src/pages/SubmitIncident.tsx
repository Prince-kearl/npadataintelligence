import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  REGIONS,
  DISTRICTS,
  INCIDENT_CATEGORIES,
  INCIDENT_TYPES,
  PRODUCT_TYPES,
  INJURY_TYPES,
  REPORT_SOURCES,
} from "@/lib/mock-data";
import { findPotentialDuplicates, type DuplicateMatch } from "@/lib/incident-verification";
import { Upload, Save, SendHorizonal, ShieldAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function SubmitIncident() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [matches, setMatches] = useState<DuplicateMatch[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  // tracked fields needed for verification
  const [incidentDate, setIncidentDate] = useState("");
  const [region, setRegion] = useState("");
  const [district, setDistrict] = useState("");
  const [locationName, setLocationName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");

  const finalizeSubmit = () => {
    setDialogOpen(false);
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      toast.success("Incident report submitted successfully", {
        description: "Verified as a new entry and recorded as INC-2026-008.",
      });
    }, 1200);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    // Cross-reference against repository
    setTimeout(() => {
      const found = findPotentialDuplicates({
        incident_date: incidentDate,
        region,
        district,
        location_name: locationName,
        category,
        description,
      });
      setVerifying(false);
      setMatches(found);
      if (found.length > 0) {
        setDialogOpen(true);
      } else {
        toast.success("Authenticity check passed — no duplicates detected.", {
          icon: <CheckCircle2 className="h-4 w-4 text-success" />,
        });
        finalizeSubmit();
      }
    }, 700);
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="page-title">Submit Incident Report</h1>
        <p className="meta-text mt-1">
          All submissions are cross-checked against existing records to prevent duplicate or outdated entries.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Location & Date */}
        <div className="dash-card space-y-4">
          <h3 className="section-title">Location & Date</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="label-text">Incident Date *</Label>
              <Input type="date" required value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} className="bg-muted/50 border-border rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label className="label-text">Region *</Label>
              <Select required value={region} onValueChange={setRegion}>
                <SelectTrigger className="bg-muted/50 border-border rounded-lg">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text">District *</Label>
              <Select required value={district} onValueChange={setDistrict}>
                <SelectTrigger className="bg-muted/50 border-border rounded-lg">
                  <SelectValue placeholder="Select district" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {DISTRICTS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text">Location / Facility Name *</Label>
              <Input placeholder="Enter facility or location name" required value={locationName} onChange={(e) => setLocationName(e.target.value)} className="bg-muted/50 border-border rounded-lg" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="label-text">GPS Coordinates</Label>
              <Input placeholder="e.g., 5.6037, -0.1870" className="bg-muted/50 border-border rounded-lg" />
            </div>
          </div>
        </div>

        {/* Incident Details */}
        <div className="dash-card space-y-4">
          <h3 className="section-title">Incident Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="label-text">Incident Category *</Label>
              <Select required value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-muted/50 border-border rounded-lg">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {INCIDENT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text">Incident Type *</Label>
              <Select required>
                <SelectTrigger className="bg-muted/50 border-border rounded-lg">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {INCIDENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text">Petroleum Product Type *</Label>
              <Select required>
                <SelectTrigger className="bg-muted/50 border-border rounded-lg">
                  <SelectValue placeholder="Select product type" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {PRODUCT_TYPES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text">Nature of Injury</Label>
              <Select>
                <SelectTrigger className="bg-muted/50 border-border rounded-lg">
                  <SelectValue placeholder="Select injury type" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {INJURY_TYPES.map((i) => (
                    <SelectItem key={i} value={i}>{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text">Casualties</Label>
              <Input type="number" min={0} defaultValue={0} className="bg-muted/50 border-border rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label className="label-text">Fatalities</Label>
              <Input type="number" min={0} defaultValue={0} className="bg-muted/50 border-border rounded-lg" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="label-text">Incident Description *</Label>
              <Textarea placeholder="Provide a detailed description..." required rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className="bg-muted/50 border-border rounded-lg" />
            </div>
          </div>
        </div>

        {/* Attachments */}
        <div className="dash-card space-y-4">
          <h3 className="section-title">Attachments</h3>
          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center bg-muted/30">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Drag & drop files here, or click to browse</p>
            <p className="meta-text mt-1">Photos, documents (max 10MB each)</p>
            <Button variant="outline" size="sm" className="mt-3" type="button">Browse Files</Button>
          </div>
        </div>

        {/* Reporter */}
        <div className="dash-card space-y-4">
          <h3 className="section-title">Reporter Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="label-text">Reporter Name</Label>
              <Input value="Admin User" disabled className="bg-muted/30 border-border rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label className="label-text">Department</Label>
              <Input value="System Administration" disabled className="bg-muted/30 border-border rounded-lg" />
            </div>
          </div>
        </div>

        {/* Source of Report */}
        <div className="dash-card space-y-4">
          <h3 className="section-title">Source of Report</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="label-text">Report Source *</Label>
              <Select required>
                <SelectTrigger className="bg-muted/50 border-border rounded-lg">
                  <SelectValue placeholder="Select source of report" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {REPORT_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text">Source Contact / Reference</Label>
              <Input placeholder="Name, phone, agency, or reference ID" className="bg-muted/50 border-border rounded-lg" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="label-text">Source Details / Notes</Label>
              <Textarea
                placeholder="Provide additional context about how this incident was reported (e.g., complaint reference, news article link, patrol log number)..."
                rows={3}
                className="bg-muted/50 border-border rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 justify-end">
          <Button variant="outline" type="button">
            <Save className="h-4 w-4 mr-1" />
            Save Draft
          </Button>
          <Button variant="default" type="submit" disabled={isSubmitting || verifying}>
            <SendHorizonal className="h-4 w-4 mr-1" />
            {verifying ? "Verifying..." : isSubmitting ? "Submitting..." : "Verify & Submit"}
          </Button>
        </div>
      </form>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-accent" />
              Possible Duplicate Detected
            </DialogTitle>
            <DialogDescription>
              The authenticity check found {matches.length} existing record{matches.length === 1 ? "" : "s"} that may match this incident.
              Please confirm this is a new, current incident before submitting.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {matches.map((m) => (
              <div key={m.incident.id} className="border border-border rounded-lg p-3 bg-muted/30">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div>
                    <div className="font-medium text-foreground text-sm">
                      {m.incident.id} · {m.incident.location_name}
                    </div>
                    <div className="meta-text">
                      {m.incident.incident_date} · {m.incident.category} · {m.incident.region}
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      m.score >= 70
                        ? "bg-destructive/10 text-destructive border border-destructive/20"
                        : "bg-accent/10 text-accent border border-accent/20"
                    }
                  >
                    {m.score}% match
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{m.incident.description}</p>
                <div className="flex flex-wrap gap-1">
                  {m.reasons.map((r, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] font-normal">{r}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Review & Edit
            </Button>
            <Button variant="default" onClick={finalizeSubmit}>
              Confirm New Incident & Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
