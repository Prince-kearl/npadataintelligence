import { useEffect, useRef, useState } from "react";
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
  INCIDENT_CATEGORIES,
  INCIDENT_TYPES,
  PRODUCT_TYPES,
  INJURY_TYPES,
  REPORT_SOURCES,
} from "@/lib/incident-options";
import { findPotentialDuplicates, type DuplicateMatch } from "@/lib/incident-verification";
import { Upload, Save, SendHorizonal, ShieldAlert, X, Camera, MapPin, RotateCcw, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  beginIncidentSubmission,
  finalizeIncidentSubmission,
  listIncidents,
  uploadAttachment,
  attachToIncident,
  scanAttachment,
  validateAttachment,
  type AttachmentMeta,
} from "@/lib/incidents";
import { saveDraft, loadDraft, deleteDraft } from "@/lib/draft-store";

const PREV_CHANNELS = [
  "None — first time reported",
  "Phone call to NPA",
  "Email to NPA",
  "Walk-in complaint",
  "Police / Fire Service",
  "Social media",
  "News media",
  "Industry operator",
  "Other agency",
];
const EVIDENCE_TAGS = ["Photo", "Document", "Video", "Witness statement", "Lab report", "Map", "Other"];

interface PendingFile {
  file: File;
  tags: string[];
}

export default function SubmitIncident() {
  const { user, profile } = useAuth();
  const draftId = `current-${user?.id ?? "signed-out"}`;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [matches, setMatches] = useState<DuplicateMatch[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

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
  const [previousChannel, setPreviousChannel] = useState("None — first time reported");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());

  const formRef = useRef<HTMLFormElement>(null);

  // Online/offline indicator
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Restore draft on mount
  useEffect(() => {
    (async () => {
      const d = await loadDraft(draftId);
      if (d && Object.keys(d.payload).length) {
        const p = d.payload as any;
        if (typeof p.submissionId === "string") setSubmissionId(p.submissionId);
        if (p.incidentDate) setIncidentDate(p.incidentDate);
        if (p.region) setRegion(p.region);
        if (p.district) setDistrict(p.district);
        if (p.locationName) setLocationName(p.locationName);
        if (p.gps) setGps(p.gps);
        if (p.category) setCategory(p.category);
        if (p.incidentType) setIncidentType(p.incidentType);
        
        if (p.productType) setProductType(p.productType);
        if (p.injuryType) setInjuryType(p.injuryType);
        if (typeof p.casualties === "number") setCasualties(p.casualties);
        if (typeof p.fatalities === "number") setFatalities(p.fatalities);
        if (p.description) setDescription(p.description);
        if (p.source) setSource(p.source);
        if (p.sourceContact) setSourceContact(p.sourceContact);
        if (p.sourceNotes) setSourceNotes(p.sourceNotes);
        if (p.previousChannel) setPreviousChannel(p.previousChannel);
        toast.message("Draft restored from last session", {
          description: `Saved ${new Date(d.updatedAt).toLocaleString()}`,
        });
      }
    })();
  }, [draftId]);

  // Auto-save every 8s (no files — those are too large for IDB drafts)
  useEffect(() => {
    const t = setInterval(() => {
      saveDraft(draftId, {
        submissionId,
        incidentDate, region, district, locationName, gps, category, incidentType,
        productType, injuryType, casualties, fatalities, description, source, sourceContact,
        sourceNotes, previousChannel,
      }).catch(() => {});
    }, 8000);
    return () => clearInterval(t);
  }, [
    draftId, submissionId, incidentDate, region, district, locationName, gps, category, incidentType,
    productType, injuryType, casualties, fatalities, description, source, sourceContact,
    sourceNotes, previousChannel,
  ]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next: PendingFile[] = [];
    for (const file of Array.from(list)) {
      try {
        validateAttachment(file);
        next.push({ file, tags: [file.type.startsWith("image/") ? "Photo" : "Document"] });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `Cannot attach ${file.name}`);
      }
    }
    setFiles((prev) => [...prev, ...next]);
  };

  const removeFile = (idx: number) => setFiles((p) => p.filter((_, i) => i !== idx));
  const toggleTag = (idx: number, tag: string) =>
    setFiles((p) =>
      p.map((f, i) =>
        i === idx
          ? { ...f, tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag] }
          : f
      )
    );

  const captureGps = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        toast.success("GPS captured");
      },
      (err) => toast.error(err.message)
    );
  };

  const finalizeSubmit = async (verificationScore?: number, verificationNotes?: string) => {
    setDialogOpen(false);
    if (!user) {
      toast.error("You must be signed in");
      return;
    }
    setIsSubmitting(true);
    try {
      // Begin is idempotent: a retry with this local submission id returns the
      // original staging incident instead of creating a duplicate.
      const inc = await beginIncidentSubmission(submissionId, {
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
        previous_channel: previousChannel || null,
        verification_score: verificationScore ?? null,
        verification_notes: verificationNotes ?? null,
      }, files.length);

      // Deterministic paths and unique metadata make this loop safe to retry.
      for (const [index, pf] of files.entries()) {
        const meta: AttachmentMeta = await uploadAttachment(user.id, submissionId, index, pf.file);
        const attachment = await attachToIncident(inc.id, user.id, pf.file, meta, pf.tags);
        await scanAttachment(attachment.id);
      }

      const submitted = await finalizeIncidentSubmission(inc.id);

      await deleteDraft(draftId);
      setSubmissionId(crypto.randomUUID());
      toast.success(`Incident submitted as ${submitted.reference_code}`);
      qc.invalidateQueries({ queryKey: ["incidents"] });
      navigate("/records");
    } catch (err: any) {
      toast.error(err.message || "Submission paused; retry to resume without creating a duplicate");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!online) {
      // Save offline — will need manual retry when back online
      await saveDraft(draftId, {
        submissionId,
        incidentDate, region, district, locationName, gps, category, incidentType,
        productType, injuryType, casualties, fatalities, description, source, sourceContact,
        sourceNotes, previousChannel,
      });
      toast.warning("Saved offline. Submit when you reconnect.");
      return;
    }
    setVerifying(true);
    try {
      const pool = await listIncidents();
      const found = findPotentialDuplicates(
        { incident_date: incidentDate, region, district, location_name: locationName, category, description, gps_coordinates: gps, previous_channel: previousChannel },
        pool
      );
      setMatches(found);
      if (found.length > 0) {
        setDialogOpen(true);
      } else {
        await finalizeSubmit(0, "No duplicates detected");
      }
    } catch (err: any) {
      toast.error(err.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const handleSaveDraft = async () => {
    await saveDraft(draftId, {
      submissionId,
      incidentDate, region, district, locationName, gps, category, incidentType,
      productType, injuryType, casualties, fatalities, description, source, sourceContact,
      sourceNotes, previousChannel,
    });
    toast.success("Draft saved locally on this device");
  };

  const handleDiscardDraft = async () => {
    await deleteDraft(draftId);
    setSubmissionId(crypto.randomUUID());
    formRef.current?.reset();
    setIncidentDate(""); setRegion(""); setDistrict(""); setLocationName(""); setGps("");
    setCategory(""); setIncidentType(""); setProductType(""); setInjuryType("");
    setCasualties(0); setFatalities(0); setDescription(""); setSource(""); setSourceContact("");
    setSourceNotes(""); setPreviousChannel("None — first time reported"); setFiles([]);
    toast.success("Draft discarded");
  };

  const topScore = matches[0]?.score ?? 0;

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Submit Incident Report</h1>
          <p className="meta-text mt-1">
            All submissions are cross-checked against existing records (date, GPS, facility name, description, channel) to prevent duplicates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!online && (
            <Badge variant="secondary" className="bg-warning/10 text-warning border border-warning/20 gap-1">
              <WifiOff className="h-3 w-3" /> Offline
            </Badge>
          )}
        </div>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
        <div className="dash-card space-y-4">
          <h3 className="section-title">Location & Date</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="label-text">Incident Date *</Label>
              <Input type="date" required value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} className="bg-muted/50 border-border rounded-lg min-h-12" />
            </div>
            <div className="space-y-2">
              <Label className="label-text">Region *</Label>
              <Select required value={region} onValueChange={setRegion}>
                <SelectTrigger className="bg-muted/50 border-border rounded-lg min-h-12"><SelectValue placeholder="Select region" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {REGIONS.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text" htmlFor="submit-district">District *</Label>
              <Input
                id="submit-district"
                list="submit-district-options"
                placeholder="Type or select a district"
                required
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="bg-muted/50 border-border rounded-lg min-h-12"
              />
              <datalist id="submit-district-options">
                {districtSuggestions.map((d) => (<option key={d} value={d} />))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label className="label-text">Location / Facility Name *</Label>
              <Input placeholder="Enter facility or location name" required value={locationName} onChange={(e) => setLocationName(e.target.value)} className="bg-muted/50 border-border rounded-lg min-h-12" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="label-text">GPS Coordinates</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input placeholder="e.g., 5.6037, -0.1870" value={gps} onChange={(e) => setGps(e.target.value)} className="bg-muted/50 border-border rounded-lg min-h-12 flex-1 min-w-0" />
                <Button type="button" variant="outline" onClick={captureGps} className="min-h-12 w-full sm:w-auto">
                  <MapPin className="h-4 w-4 mr-1" /> Use My Location
                </Button>
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
                <SelectTrigger className="bg-muted/50 border-border rounded-lg min-h-12"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {INCIDENT_CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text">Incident Type *</Label>
              <Select required value={incidentType} onValueChange={setIncidentType}>
                <SelectTrigger className="bg-muted/50 border-border rounded-lg min-h-12"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {INCIDENT_TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text">Severity *</Label>
              <Select required value={severity} onValueChange={(v) => setSeverity(v as IncidentSeverity)}>
                <SelectTrigger className="bg-muted/50 border-border rounded-lg min-h-12"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {(Object.keys(SEVERITY_LABELS) as IncidentSeverity[]).map((s) => (
                    <SelectItem key={s} value={s}>{SEVERITY_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text">Petroleum Product Type *</Label>
              <Select required value={productType} onValueChange={setProductType}>
                <SelectTrigger className="bg-muted/50 border-border rounded-lg min-h-12"><SelectValue placeholder="Select product type" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {PRODUCT_TYPES.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text">Nature of Injury</Label>
              <Select value={injuryType} onValueChange={setInjuryType}>
                <SelectTrigger className="bg-muted/50 border-border rounded-lg min-h-12"><SelectValue placeholder="Select injury type" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {INJURY_TYPES.map((i) => (<SelectItem key={i} value={i}>{i}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text">Casualties</Label>
              <Input type="number" min={0} value={casualties} onChange={(e) => setCasualties(Number(e.target.value))} className="bg-muted/50 border-border rounded-lg min-h-12" />
            </div>
            <div className="space-y-2">
              <Label className="label-text">Fatalities</Label>
              <Input type="number" min={0} value={fatalities} onChange={(e) => setFatalities(Number(e.target.value))} className="bg-muted/50 border-border rounded-lg min-h-12" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="label-text">Incident Description *</Label>
              <Textarea placeholder="Provide a detailed description..." required rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className="bg-muted/50 border-border rounded-lg" />
            </div>
          </div>
        </div>

        <div className="dash-card space-y-4">
          <h3 className="section-title">Evidence & Attachments</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="border-2 border-dashed border-border rounded-xl p-6 text-center bg-muted/30 block cursor-pointer hover:bg-muted/50 transition-colors min-h-[120px]">
              <Upload className="h-7 w-7 mx-auto text-muted-foreground mb-1" />
              <p className="text-sm text-muted-foreground">Click to browse or drop files</p>
              <p className="meta-text mt-1">Max 10MB per file</p>
              <input type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" />
            </label>
            <label className="border-2 border-dashed border-border rounded-xl p-6 text-center bg-muted/30 block cursor-pointer hover:bg-muted/50 transition-colors min-h-[120px]">
              <Camera className="h-7 w-7 mx-auto text-muted-foreground mb-1" />
              <p className="text-sm text-muted-foreground">Use camera to capture</p>
              <p className="meta-text mt-1">Mobile field photo</p>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => addFiles(e.target.files)} />
            </label>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((pf, i) => (
                <div key={i} className="bg-muted/40 rounded-lg px-3 py-2 text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">
                      {pf.file.name}{" "}
                      <span className="text-muted-foreground font-normal">({(pf.file.size / 1024).toFixed(1)} KB)</span>
                    </span>
                    <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive shrink-0">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {EVIDENCE_TAGS.map((t) => {
                      const on = pf.tags.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleTag(i, t)}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                            on ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-muted"
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dash-card space-y-4">
          <h3 className="section-title">Source of Report</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="label-text">Report Source *</Label>
              <Select required value={source} onValueChange={setSource}>
                <SelectTrigger className="bg-muted/50 border-border rounded-lg min-h-12"><SelectValue placeholder="Select source of report" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {REPORT_SOURCES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text">Previously Reported Via</Label>
              <Select value={previousChannel} onValueChange={setPreviousChannel}>
                <SelectTrigger className="bg-muted/50 border-border rounded-lg min-h-12"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {PREV_CHANNELS.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text">Source Contact / Reference</Label>
              <Input value={sourceContact} onChange={(e) => setSourceContact(e.target.value)} placeholder="Name, phone, agency, or reference ID" className="bg-muted/50 border-border rounded-lg min-h-12" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="label-text">Source Details / Notes</Label>
              <Textarea value={sourceNotes} onChange={(e) => setSourceNotes(e.target.value)} placeholder="Additional context about how this incident was reported..." rows={3} className="bg-muted/50 border-border rounded-lg" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:flex sm:items-center gap-2 sm:gap-3 sm:justify-end">
          <Button variant="ghost" type="button" onClick={handleDiscardDraft} className="min-h-12 w-full sm:w-auto">
            <RotateCcw className="h-4 w-4 mr-1" /> Discard
          </Button>
          <Button variant="outline" type="button" onClick={handleSaveDraft} className="min-h-12 w-full sm:w-auto">
            <Save className="h-4 w-4 mr-1" /> Save Draft
          </Button>
          <Button variant="default" type="submit" disabled={isSubmitting || verifying} className="min-h-12 w-full sm:w-auto">
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
              The authenticity engine flagged {matches.length} existing record{matches.length === 1 ? "" : "s"} that may match this incident.
              Please confirm before submitting — your decision is recorded in the audit log.
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
            <Button
              variant="default"
              onClick={() => finalizeSubmit(topScore, `User confirmed despite ${matches.length} potential match(es); top score ${topScore}%`)}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Confirm New Incident & Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
