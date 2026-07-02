import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Fingerprint,
  History,
  Link2,
  Loader2,
  MapPin,
  Paperclip,
  RadioTower,
  ShieldCheck,
  Upload,
  Trash2,
  Save,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, LoadingState } from "@/components/ReliabilityState";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { useIncidents } from "@/hooks/useIncidents";
import { useRole } from "@/hooks/useRole";
import { findPotentialDuplicates } from "@/lib/incident-verification";
import {
  deleteIncidentRecord,
  getAttachmentSignedUrl,
  getIncident,
  listAttachments,
  listResponseActions,
  listStatusHistory,
  updateAttachmentTags,
  deleteAttachment,
  uploadAttachment,
  attachToIncident,
  scanAttachment,
  validateAttachment,
  SEVERITY_LABELS,
  STATUS_LABELS,
  updateIncidentDetails,
  updateIncidentStatus,
  type AttachmentMeta,
  type IncidentSeverity,
  type IncidentStatus,
} from "@/lib/incidents";
import { useAuth } from "@/hooks/useAuth";

interface PendingFile {
  file: File;
  tags: string[];
}

const EVIDENCE_TAGS = ["Photo", "Document", "Video", "Witness statement", "Lab report", "Map", "Other"];

const statusClass: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-info/10 text-info border-info/20",
  under_review: "bg-warning/10 text-warning border-warning/20",
  returned: "bg-destructive/10 text-destructive border-destructive/20",
  verified: "bg-success/10 text-success border-success/20",
  Closed: "bg-muted text-muted-foreground",
  archived: "bg-muted text-muted-foreground",
  New: "bg-info/10 text-info border-info/20",
  Reviewed: "bg-warning/10 text-warning border-warning/20",
};

const severityClass: Record<IncidentSeverity, string> = {
  low: "bg-success/10 text-success border-success/20",
  medium: "bg-info/10 text-info border-info/20",
  high: "bg-warning/10 text-warning border-warning/20",
  critical: "bg-destructive/10 text-destructive border-destructive/20",
};

const scanClass: Record<string, string> = {
  clean: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  infected: "bg-destructive/10 text-destructive border-destructive/20",
  skipped: "bg-muted text-muted-foreground border-border",
};

const actionLabels: Record<string, string> = {
  dispatch_team: "Dispatch Team",
  escalate_alert: "Escalate Alert",
  lockdown_protocol: "Lockdown Protocol",
  request_reinforcement: "Request Reinforcement",
};

function formatDate(value: string, includeTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  }).format(date);
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function Detail({ label, value }: { label: string; value: unknown }) {
  const shown = value === null || value === undefined || value === "" ? "Not provided" : String(value);
  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-muted/20 p-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-foreground">{shown}</dd>
    </div>
  );
}

export default function IncidentCase() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role, can, allowedTransitions } = useRole();
  const { user } = useAuth();
  const { data: incidents = [] } = useIncidents();
  const [targetStatus, setTargetStatus] = useState<IncidentStatus | null>(null);
  const [transitionNote, setTransitionNote] = useState("");
  const [openingEvidence, setOpeningEvidence] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [savingTags, setSavingTags] = useState<string | null>(null);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [pendingAttachmentDelete, setPendingAttachmentDelete] = useState<{ id: string; path: string; name: string } | null>(null);
  const [editDraft, setEditDraft] = useState({
    location_name: "",
    district: "",
    gps_coordinates: "",
    description: "",
    source_notes: "",
  });

  const incidentQuery = useQuery({
    queryKey: ["incident", id],
    queryFn: () => getIncident(id),
    enabled: Boolean(id),
  });
  const attachmentsQuery = useQuery({
    queryKey: ["incident-attachments", id],
    queryFn: () => listAttachments(id),
    enabled: Boolean(id) && Boolean(incidentQuery.data),
  });
  const historyQuery = useQuery({
    queryKey: ["incident-status-history", id],
    queryFn: () => listStatusHistory(id),
    enabled: Boolean(id) && Boolean(incidentQuery.data),
  });
  const canViewCommands = role === "analyst" || role === "admin";
  const actionsQuery = useQuery({
    queryKey: ["incident-response-actions", id],
    queryFn: () => listResponseActions(id),
    enabled: Boolean(id) && Boolean(incidentQuery.data) && canViewCommands,
  });

  const incident = incidentQuery.data;
  const related = useMemo(() => {
    if (!incident) return [];
    return findPotentialDuplicates(
      {
        incident_date: incident.incident_date,
        region: incident.region,
        district: incident.district ?? "",
        location_name: incident.location_name,
        category: incident.category,
        description: incident.description,
        gps_coordinates: incident.gps_coordinates ?? undefined,
        previous_channel: incident.previous_channel ?? undefined,
      },
      incidents.filter((item) => item.id !== incident.id),
    );
  }, [incident, incidents]);

  const transition = useMutation({
    mutationFn: async () => {
      if (!incident || !targetStatus || !transitionNote.trim()) throw new Error("Add a transition note");
      await updateIncidentStatus(incident.id, targetStatus, transitionNote.trim());
    },
    onSuccess: async () => {
      toast.success(`Incident moved to ${STATUS_LABELS[targetStatus || ""] || targetStatus}`);
      setTargetStatus(null);
      setTransitionNote("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["incident", id] }),
        queryClient.invalidateQueries({ queryKey: ["incidents"] }),
        queryClient.invalidateQueries({ queryKey: ["incident-status-history", id] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message || "Status transition failed"),
  });

  const updateDetails = useMutation({
    mutationFn: async () => {
      if (!incident) throw new Error("Incident not found");
      return updateIncidentDetails(incident.id, {
        location_name: editDraft.location_name,
        district: editDraft.district,
        gps_coordinates: editDraft.gps_coordinates,
        description: editDraft.description,
        source_notes: editDraft.source_notes,
      });
    },
    onSuccess: async () => {
      toast.success("Incident details updated");
      setEditOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["incident", id] }),
        queryClient.invalidateQueries({ queryKey: ["incidents"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message || "Update failed"),
  });

  const removeIncident = useMutation({
    mutationFn: async () => {
      if (!incident) throw new Error("Incident not found");
      return deleteIncidentRecord(incident.id, deleteReason);
    },
    onSuccess: async () => {
      toast.success("Incident deleted");
      setDeleteOpen(false);
      setDeleteReason("");
      await queryClient.invalidateQueries({ queryKey: ["incidents"] });
      navigate("/records");
    },
    onError: (error: Error) => toast.error(error.message || "Delete failed"),
  });

  const openEvidence = async (attachmentId: string, path: string) => {
    try {
      setOpeningEvidence(attachmentId);
      const url = await getAttachmentSignedUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open evidence");
    } finally {
      setOpeningEvidence(null);
    }
  };

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

  const removePendingFile = (idx: number) => setFiles((prev) => prev.filter((_, index) => index !== idx));

  const togglePendingTag = (idx: number, tag: string) => {
    setFiles((prev) =>
      prev.map((entry, index) =>
        index === idx
          ? {
              ...entry,
              tags: entry.tags.includes(tag) ? entry.tags.filter((t) => t !== tag) : [...entry.tags, tag],
            }
          : entry
      )
    );
  };

  const uploadEvidence = async () => {
    if (!incident || !user || files.length === 0) return;
    setUploadingEvidence(true);
    try {
      const stamp = Date.now();
      for (const [index, pf] of files.entries()) {
        const seq = stamp + index;
        const meta: AttachmentMeta = await uploadAttachment(user.id, incident.id, seq, pf.file);
        const attachment = await attachToIncident(incident.id, user.id, pf.file, meta, pf.tags);
        await scanAttachment(attachment.id);
      }
      setFiles([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["incident-attachments", id] }),
        queryClient.invalidateQueries({ queryKey: ["incident", id] }),
      ]);
      toast.success("Evidence uploaded and queued for malware scan");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload evidence");
    } finally {
      setUploadingEvidence(false);
    }
  };

  const toggleAttachmentTag = async (attachmentId: string, currentTags: string[], tag: string) => {
    const cacheKey = ["incident-attachments", id];
    const previous = queryClient.getQueryData(cacheKey);
    const nextTags = currentTags.includes(tag)
      ? currentTags.filter((entry) => entry !== tag)
      : [...currentTags, tag];

    queryClient.setQueryData(cacheKey, (rows: any[] | undefined) =>
      (rows ?? []).map((row) => (row.id === attachmentId ? { ...row, tags: nextTags } : row))
    );

    setSavingTags(attachmentId);
    try {
      await updateAttachmentTags(attachmentId, nextTags);
    } catch (error) {
      queryClient.setQueryData(cacheKey, previous);
      toast.error(error instanceof Error ? error.message : "Could not update evidence tags");
    } finally {
      setSavingTags(null);
    }
  };

  const removeAttachment = async () => {
    if (!pendingAttachmentDelete) return;
    const cacheKey = ["incident-attachments", id];
    const previous = queryClient.getQueryData(cacheKey);

    queryClient.setQueryData(cacheKey, (rows: any[] | undefined) =>
      (rows ?? []).filter((row) => row.id !== pendingAttachmentDelete.id)
    );

    setDeletingAttachmentId(pendingAttachmentDelete.id);
    try {
      await deleteAttachment(pendingAttachmentDelete.id, pendingAttachmentDelete.path);
      toast.success("Attachment removed");
      setPendingAttachmentDelete(null);
    } catch (error) {
      queryClient.setQueryData(cacheKey, previous);
      toast.error(error instanceof Error ? error.message : "Could not remove attachment");
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  if (incidentQuery.isLoading) {
    return <LoadingState label="Loading incident case…" className="min-h-[55vh]" />;
  }

  if (incidentQuery.isError) {
    return <ErrorState title="Incident case could not be loaded" error={incidentQuery.error} onRetry={() => void incidentQuery.refetch()} className="min-h-[55vh]" />;
  }

  if (!incident) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-warning" />
        <h1 className="mt-4 text-xl font-semibold">Incident unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">The case does not exist, or your role does not have access to it.</p>
        <Button className="mt-6" variant="outline" onClick={() => navigate("/records")}>Back to records</Button>
      </div>
    );
  }

  const transitions = can("edit_records") ? allowedTransitions(incident.status) : [];
  const history = [...(historyQuery.data ?? [])].reverse();

  const openEdit = () => {
    setEditDraft({
      location_name: incident.location_name || "",
      district: incident.district || "",
      gps_coordinates: incident.gps_coordinates || "",
      description: incident.description || "",
      source_notes: incident.source_notes || "",
    });
    setEditOpen(true);
  };

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <Link to="/records" className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Incident records
        </Link>
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-all text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {incident.reference_code || incident.id}
              </h1>
              <Badge variant="outline" className={statusClass[incident.status]}>{STATUS_LABELS[incident.status] || incident.status}</Badge>
              <Badge variant="outline" className={severityClass[incident.severity]}>{SEVERITY_LABELS[incident.severity]}</Badge>
            </div>
            <p className="mt-2 text-base font-medium text-foreground">{incident.category} · {incident.location_name}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{formatDate(incident.incident_date)}</span>
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{incident.district ? `${incident.district}, ` : ""}{incident.region}</span>
              <span className="inline-flex items-center gap-1.5"><Fingerprint className="h-4 w-4" />{incident.id.slice(0, 8)}</span>
            </div>
          </div>
          {transitions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={openEdit}>Edit details</Button>
              {transitions.map((status) => (
                <Button key={status} size="sm" onClick={() => setTargetStatus(status)}>
                  Move to {STATUS_LABELS[status] || status}<ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ))}
              {role === "admin" && (
                <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>Delete incident</Button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Full incident details</CardTitle>
            <CardDescription>Operational record and reporting context</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Incident type" value={incident.incident_type} />
              <Detail label="Product" value={incident.product_type} />
              <Detail label="GPS coordinates" value={incident.gps_coordinates} />
              <Detail label="Casualties" value={incident.casualties} />
              <Detail label="Fatalities" value={incident.fatalities} />
              <Detail label="Injury type" value={incident.injury_type} />
              <Detail label="Reporter" value={incident.reporter_name} />
              <Detail label="Department" value={incident.department} />
              <Detail label="Source" value={incident.source} />
              <Detail label="Source contact" value={incident.source_contact} />
              <Detail label="Previous channel" value={incident.previous_channel} />
              <Detail label="Submission state" value={incident.submission_state} />
            </dl>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Incident description</h3>
              <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/30 p-4 text-sm leading-6 text-foreground">{incident.description}</p>
            </div>
            {(incident.source_notes || incident.verification_notes || incident.verification_score !== null) && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm font-semibold">Source notes</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{incident.source_notes || "No source notes recorded."}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Verification</p>
                    {incident.verification_score !== null && <Badge variant="secondary">{incident.verification_score}% confidence</Badge>}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{incident.verification_notes || "No verification notes recorded."}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><History className="h-5 w-5 text-primary" />Status timeline</CardTitle>
            <CardDescription>Authenticated lifecycle changes</CardDescription>
          </CardHeader>
          <CardContent>
            {historyQuery.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : historyQuery.isError ? (
              <ErrorState title="Timeline could not be loaded" error={historyQuery.error} onRetry={() => void historyQuery.refetch()} className="min-h-36 border-0" />
            ) : history.length ? (
              <ol className="relative ml-2 border-l border-border">
                {history.map((event, index) => (
                  <li key={event.id} className="relative pb-6 pl-6 last:pb-0">
                    <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-card bg-primary" />
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className={statusClass[event.to_status]}>{STATUS_LABELS[event.to_status] || event.to_status}</Badge>
                      {event.from_status && <span className="text-xs text-muted-foreground">from {STATUS_LABELS[event.from_status] || event.from_status}</span>}
                    </div>
                    <p className="mt-2 text-sm text-foreground">{event.note || (index === 0 ? "Incident created" : "No transition note")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(event.created_at, true)} · {event.changed_by_email || "System"}</p>
                  </li>
                ))}
              </ol>
            ) : <p className="text-sm text-muted-foreground">No lifecycle events have been recorded.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Paperclip className="h-5 w-5 text-primary" />Evidence and scan status</CardTitle>
          <CardDescription>Files are available only after server-side malware scanning marks them clean.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 rounded-lg border border-border p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Add evidence</p>
            <label className="block cursor-pointer rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
              <Upload className="mx-auto mb-1.5 h-5 w-5 text-primary" />
              Choose files (max 10MB each)
              <input type="file" multiple className="hidden" onChange={(event) => addFiles(event.target.files)} accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" />
            </label>
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((entry, index) => (
                  <div key={`${entry.file.name}-${index}`} className="rounded-md border border-border/70 bg-muted/20 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-foreground truncate">{entry.file.name}</p>
                      <Button size="sm" variant="ghost" onClick={() => removePendingFile(index)}>Remove</Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {EVIDENCE_TAGS.map((tag) => {
                        const selected = entry.tags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => togglePendingTag(index, tag)}
                            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-muted"}`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="flex justify-end">
                  <Button onClick={uploadEvidence} disabled={uploadingEvidence || files.length === 0}>
                    {uploadingEvidence ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Upload evidence
                  </Button>
                </div>
              </div>
            )}
          </div>

          {attachmentsQuery.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : attachmentsQuery.isError ? (
            <ErrorState title="Evidence could not be loaded" error={attachmentsQuery.error} onRetry={() => void attachmentsQuery.refetch()} className="min-h-36 border-0" />
          ) : attachmentsQuery.data?.length ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {attachmentsQuery.data.map((file) => (
                <article key={file.id} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-start">
                  <div className="rounded-lg bg-muted p-2.5"><FileText className="h-5 w-5 text-primary" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground" title={file.file_name}>{file.file_name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatBytes(file.file_size)} · version {file.version} · {file.mime_type || "Unknown type"}</p>
                      </div>
                      <Badge variant="outline" className={scanClass[file.scan_status]}>{file.scan_status}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {EVIDENCE_TAGS.map((tag) => {
                        const selected = file.tags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleAttachmentTag(file.id, file.tags, tag)}
                            disabled={savingTags === file.id}
                            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-muted"}`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                    {file.scan_notes && <p className="mt-2 text-xs text-muted-foreground">{file.scan_notes}</p>}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">Added {formatDate(file.created_at, true)}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={file.scan_status !== "clean" || openingEvidence === file.id}
                          onClick={() => openEvidence(file.id, file.storage_path)}
                        >
                          {openingEvidence === file.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
                          Open
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPendingAttachmentDelete({ id: file.id, path: file.storage_path, name: file.file_name })}
                          disabled={deletingAttachmentId === file.id}
                        >
                          {deletingAttachmentId === file.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No evidence files are attached to this incident.</p>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><RadioTower className="h-5 w-5 text-primary" />Response-command history</CardTitle>
            <CardDescription>Regulatory actions issued against this case</CardDescription>
          </CardHeader>
          <CardContent>
            {!canViewCommands ? (
              <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
                Response commands are restricted to analysts and administrators.
              </div>
            ) : actionsQuery.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : actionsQuery.isError ? (
              <ErrorState title="Response history could not be loaded" error={actionsQuery.error} onRetry={() => void actionsQuery.refetch()} className="min-h-36 border-0" />
            ) : actionsQuery.data?.length ? (
              <div className="space-y-3">
                {actionsQuery.data.map((action) => (
                  <article key={action.id} className="rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-foreground">{actionLabels[action.action_type] || action.action_type}</p>
                      <div className="flex gap-1.5">
                        <Badge variant="outline" className={severityClass[action.priority]}>{action.priority}</Badge>
                        <Badge variant="secondary">{action.status}</Badge>
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{action.instructions}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{action.requested_by_email || "System"}</span>
                      <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{formatDate(action.created_at, true)}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No regulatory response commands have been issued.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Link2 className="h-5 w-5 text-primary" />Related or duplicate incidents</CardTitle>
            <CardDescription>Potential matches based on time, location, category and description</CardDescription>
          </CardHeader>
          <CardContent>
            {related.length ? (
              <div className="space-y-3">
                {related.map((match) => (
                  <Link key={match.incident.id} to={`/incidents/${match.incident.id}`} className="group block rounded-lg border border-border p-4 transition-colors hover:bg-muted/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground group-hover:text-primary">{match.incident.reference_code || match.incident.id.slice(0, 8)}</p>
                        <p className="mt-1 truncate text-sm text-muted-foreground">{match.incident.category} · {match.incident.location_name}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0">{match.score}% match</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {match.reasons.map((reason) => <Badge key={reason} variant="secondary" className="font-normal">{reason}</Badge>)}
                    </div>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">Open related case <ExternalLink className="h-3 w-3" /></span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-5">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground"><ShieldCheck className="h-4 w-4 text-success" />No likely duplicates found</div>
                <p className="mt-1 text-xs text-muted-foreground">No visible incident reached the 40% similarity threshold.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(targetStatus)} onOpenChange={(open) => !open && setTargetStatus(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transition incident to {targetStatus ? STATUS_LABELS[targetStatus] || targetStatus : ""}</DialogTitle>
            <DialogDescription>The note will become part of the authenticated case timeline.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={transitionNote}
            onChange={(event) => setTransitionNote(event.target.value)}
            placeholder="Explain the decision, evidence reviewed, or follow-up required…"
            maxLength={1000}
          />
          <div className="text-right text-xs text-muted-foreground">{transitionNote.length}/1000</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTargetStatus(null)}>Cancel</Button>
            <Button disabled={!transitionNote.trim() || transition.isPending} onClick={() => transition.mutate()}>
              {transition.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm transition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit incident details</DialogTitle>
            <DialogDescription>Update operational details for this incident. Changes are audit-tracked.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="edit-location">Location</Label>
              <Input id="edit-location" value={editDraft.location_name} onChange={(e) => setEditDraft((p) => ({ ...p, location_name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-district">District</Label>
              <Input id="edit-district" value={editDraft.district} onChange={(e) => setEditDraft((p) => ({ ...p, district: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-gps">GPS coordinates</Label>
              <Input id="edit-gps" value={editDraft.gps_coordinates} onChange={(e) => setEditDraft((p) => ({ ...p, gps_coordinates: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea id="edit-description" rows={4} value={editDraft.description} onChange={(e) => setEditDraft((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-source-notes">Source notes</Label>
              <Textarea id="edit-source-notes" rows={3} value={editDraft.source_notes} onChange={(e) => setEditDraft((p) => ({ ...p, source_notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => updateDetails.mutate()} disabled={updateDetails.isPending}>
              {updateDetails.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={(open) => !removeIncident.isPending && setDeleteOpen(open)}
        title="Delete this incident record?"
        description="This removes the record from active views and logs an administrative delete event."
        confirmLabel="Delete incident"
        destructive
        pending={removeIncident.isPending}
        onConfirm={() => removeIncident.mutate()}
      />

      <ConfirmationDialog
        open={Boolean(pendingAttachmentDelete)}
        onOpenChange={(open) => !open && !deletingAttachmentId && setPendingAttachmentDelete(null)}
        title="Delete this attachment?"
        description={`${pendingAttachmentDelete?.name || "This file"} will be removed from evidence records and storage.`}
        confirmLabel="Delete attachment"
        destructive
        pending={Boolean(deletingAttachmentId)}
        onConfirm={removeAttachment}
      />
    </div>
  );
}
