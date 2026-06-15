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
import { Upload, Save, SendHorizonal, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { createIncident, listIncidents, uploadAttachment, type AttachmentMeta } from "@/lib/incidents";

export default function SubmitIncident() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [matches, setMatches] = useState<DuplicateMatch[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [incidentDate, setIncidentDate] = useState("");
  const [region, setRegion] = useState("");
  const [district, setDistrict] = useState("");
  const [locationName, setLocationName] = useState("");
  const [gps, setGps] = useState("");
  const [category, setCategory] = useState("");
  const [incidentType, setIncidentType] = useState("");
  const [productType, setProductType] = useState("");
  const [injuryType, setInjuryType] = useState("");
  const [casualties, setCasualties] = useState(0);
  const [fatalities, setFatalities] = useState(0);
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("");
  const [sourceContact, setSourceContact] = useState("");
  const [sourceNotes, setSourceNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = Array.from(list).filter((f) => f.size <= 10 * 1024 * 1024);
    if (next.length !== list.length) toast.warning("Some files exceeded 10MB and were skipped");
    setFiles((prev) => [...prev, ...next]);
  };

  const removeFile = (idx: number) => setFiles((p) => p.filter((_, i) => i !== idx));

  const captureGps = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported on this device");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`),
      (err) => toast.error(err.message)
    );
  };

  const finalizeSubmit = async () => {
    setDialogOpen(false);
    if (!user) {
      toast.error("You must be signed in");
      return;
    }
    setIsSubmitting(true);
    try {
      // 1. Upload attachments first
      const attachments: AttachmentMeta[] = [];
      for (const f of files) {
        const meta = await uploadAttachment(user.id, f);
        attachments.push(meta);
      }
      // 2. Insert incident
      const inc = await createIncident({
        reporter_id: user.id,
        reporter_name: profile?.full_name || profile?.email || "Unknown",
        department: profile?.department || null,
        incident_date: incidentDate,
        region,
        district,
        location_name: locationName,
        gps_coordinates: gps || null,
        category,
        incident_type: incidentType || null,
        product_type: productType || null,
        injury_type: injuryType || null,
        casualties,
        fatalities,
        description,
        source: source || null,
        source_contact: sourceContact || null,
        source_notes: sourceNotes || null,
        attachments: attachments as any,
        status: "New",
      });
      toast.success(`Incident submitted as ${inc.reference_code}`);
      qc.invalidateQueries({ queryKey: ["incidents"] });
      navigate("/records");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit incident");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setVerifying(true);
    try {
      const pool = await listIncidents();
      const found = findPotentialDuplicates(
        { incident_date: incidentDate, region, district, location_name: locationName, category, description },
        pool
      );
      setMatches(found);
      if (found.length > 0) {
        setDialogOpen(true);
      } else {
        await finalizeSubmit();
      }
    } catch (err: any) {
      toast.error(err.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
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
                  {REGIONS.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
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
                  {DISTRICTS.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text">Location / Facility Name *</Label>
              <Input placeholder="Enter facility or location name" required value={locationName} onChange={(e) => setLocationName(e.target.value)} className="bg-muted/50 border-border rounded-lg" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="label-text">GPS Coordinates</Label>
              <div className="flex gap-2">
                <Input placeholder="e.g., 5.6037, -0.1870" value={gps} onChange={(e) => setGps(e.target.value)} className="bg-muted/50 border-border rounded-lg" />
                <Button type="button" variant="outline" onClick={captureGps}>Use My Location</Button>
              </div>
            </div>
          </div>
        </div>

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
                  {INCIDENT_CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text">Incident Type *</Label>
              <Select required value={incidentType} onValueChange={setIncidentType}>
                <SelectTrigger className="bg-muted/50 border-border rounded-lg">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {INCIDENT_TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text">Petroleum Product Type *</Label>
              <Select required value={productType} onValueChange={setProductType}>
                <SelectTrigger className="bg-muted/50 border-border rounded-lg">
                  <SelectValue placeholder="Select product type" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {PRODUCT_TYPES.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text">Nature of Injury</Label>
              <Select value={injuryType} onValueChange={setInjuryType}>
                <SelectTrigger className="bg-muted/50 border-border rounded-lg">
                  <SelectValue placeholder="Select injury type" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {INJURY_TYPES.map((i) => (<SelectItem key={i} value={i}>{i}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text">Casualties</Label>
              <Input type="number" min={0} value={casualties} onChange={(e) => setCasualties(Number(e.target.value))} className="bg-muted/50 border-border rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label className="label-text">Fatalities</Label>
              <Input type="number" min={0} value={fatalities} onChange={(e) => setFatalities(Number(e.target.value))} className="bg-muted/50 border-border rounded-lg" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="label-text">Incident Description *</Label>
              <Textarea placeholder="Provide a detailed description..." required rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className="bg-muted/50 border-border rounded-lg" />
            </div>
          </div>
        </div>

        <div className="dash-card space-y-4">
          <h3 className="section-title">Attachments</h3>
          <label className="border-2 border-dashed border-border rounded-xl p-8 text-center bg-muted/30 block cursor-pointer hover:bg-muted/50 transition-colors">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Click to browse or drop files</p>
            <p className="meta-text mt-1">Photos, documents (max 10MB each)</p>
            <input type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
          </label>
          {files.length > 0 && (
            <div className="space-y-1.5">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between bg-muted/40 rounded-md px-3 py-2 text-xs">
                  <span className="truncate">{f.name} <span className="text-muted-foreground">({(f.size / 1024).toFixed(1)} KB)</span></span>
                  <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dash-card space-y-4">
          <h3 className="section-title">Reporter Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="label-text">Reporter Name</Label>
              <Input value={profile?.full_name || profile?.email || ""} disabled className="bg-muted/30 border-border rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label className="label-text">Department</Label>
              <Input value={profile?.department || ""} disabled className="bg-muted/30 border-border rounded-lg" />
            </div>
          </div>
        </div>

        <div className="dash-card space-y-4">
          <h3 className="section-title">Source of Report</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="label-text">Report Source *</Label>
              <Select required value={source} onValueChange={setSource}>
                <SelectTrigger className="bg-muted/50 border-border rounded-lg">
                  <SelectValue placeholder="Select source of report" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {REPORT_SOURCES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text">Source Contact / Reference</Label>
              <Input value={sourceContact} onChange={(e) => setSourceContact(e.target.value)} placeholder="Name, phone, agency, or reference ID" className="bg-muted/50 border-border rounded-lg" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="label-text">Source Details / Notes</Label>
              <Textarea
                value={sourceNotes}
                onChange={(e) => setSourceNotes(e.target.value)}
                placeholder="Provide additional context about how this incident was reported..."
                rows={3}
                className="bg-muted/50 border-border rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 justify-end">
          <Button variant="outline" type="button" disabled>
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
                      {m.incident.reference_code} · {m.incident.location_name}
                    </div>
                    <div className="meta-text">
                      {m.incident.incident_date} · {m.incident.category} · {m.incident.region}
                    </div>
                  </div>
                  <Badge variant="secondary" className={m.score >= 70 ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-accent/10 text-accent border border-accent/20"}>
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Review & Edit</Button>
            <Button variant="default" onClick={finalizeSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Confirm New Incident & Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
