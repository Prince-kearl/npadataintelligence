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
  REGIONS,
  DISTRICTS,
  INCIDENT_CATEGORIES,
  INCIDENT_TYPES,
  PRODUCT_TYPES,
  INJURY_TYPES,
} from "@/lib/mock-data";
import { Upload, Save, SendHorizonal } from "lucide-react";
import { toast } from "sonner";

export default function SubmitIncident() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      toast.success("Incident report submitted successfully", {
        description: "Your report has been recorded and assigned ID INC-2026-008.",
      });
    }, 1500);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="page-title">Submit Incident Report</h1>
        <p className="meta-text mt-1">Complete all required fields to submit a new incident report.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Location & Date */}
        <div className="kpi-card space-y-4">
          <h3 className="section-title">Location & Date</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="label-text">Incident Date *</Label>
              <Input type="date" required className="bg-background" />
            </div>
            <div className="space-y-2">
              <Label className="label-text">Region *</Label>
              <Select required>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text">District *</Label>
              <Select required>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select district" />
                </SelectTrigger>
                <SelectContent>
                  {DISTRICTS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text">Location / Facility Name *</Label>
              <Input placeholder="Enter facility or location name" required className="bg-background" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="label-text">GPS Coordinates</Label>
              <Input placeholder="e.g., 5.6037, -0.1870 (auto-captured if allowed)" className="bg-background" />
            </div>
          </div>
        </div>

        {/* Incident Details */}
        <div className="kpi-card space-y-4">
          <h3 className="section-title">Incident Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="label-text">Incident Category *</Label>
              <Select required>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text">Incident Type *</Label>
              <Select required>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text">Petroleum Product Type *</Label>
              <Select required>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select product type" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text">Nature of Injury</Label>
              <Select>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select injury type" />
                </SelectTrigger>
                <SelectContent>
                  {INJURY_TYPES.map((i) => (
                    <SelectItem key={i} value={i}>{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-text">Casualties</Label>
              <Input type="number" min={0} defaultValue={0} className="bg-background" />
            </div>
            <div className="space-y-2">
              <Label className="label-text">Fatalities</Label>
              <Input type="number" min={0} defaultValue={0} className="bg-background" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="label-text">Incident Description *</Label>
              <Textarea
                placeholder="Provide a detailed description of the incident..."
                required
                rows={4}
                className="bg-background"
              />
            </div>
          </div>
        </div>

        {/* Attachments */}
        <div className="kpi-card space-y-4">
          <h3 className="section-title">Attachments</h3>
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Drag & drop files here, or click to browse
            </p>
            <p className="meta-text mt-1">Photos, documents (max 10MB each)</p>
            <Button variant="outline" size="sm" className="mt-3" type="button">
              Browse Files
            </Button>
          </div>
        </div>

        {/* Reporter Info (auto-filled) */}
        <div className="kpi-card space-y-4">
          <h3 className="section-title">Reporter Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="label-text">Reporter Name</Label>
              <Input value="Admin User" disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label className="label-text">Department</Label>
              <Input value="System Administration" disabled className="bg-muted" />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 justify-end">
          <Button variant="outline" type="button">
            <Save className="h-4 w-4 mr-1" />
            Save Draft
          </Button>
          <Button variant="accent" type="submit" disabled={isSubmitting}>
            <SendHorizonal className="h-4 w-4 mr-1" />
            {isSubmitting ? "Submitting..." : "Submit Report"}
          </Button>
        </div>
      </form>
    </div>
  );
}
