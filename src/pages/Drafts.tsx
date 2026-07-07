import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileEdit, Trash2, ArrowRight, Inbox } from "lucide-react";
import { toast } from "sonner";
import { listDrafts, deleteDraft, type IncidentDraft } from "@/lib/draft-store";
import { useAuth } from "@/hooks/useAuth";
import { LoadingState } from "@/components/ReliabilityState";

export default function Drafts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<IncidentDraft[] | null>(null);

  const refresh = async () => {
    const all = await listDrafts();
    // Only show current user's drafts (id pattern: current-<userId>)
    const scoped = user ? all.filter((d) => d.id === `current-${user.id}`) : all;
    setDrafts(scoped);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const summarize = (d: IncidentDraft) => {
    const p = d.payload as Record<string, any>;
    const bits = [p.category, p.incidentType, p.region, p.district, p.locationName].filter(Boolean);
    return bits.length ? bits.join(" · ") : "Untitled draft";
  };

  const remove = async (id: string) => {
    await deleteDraft(id);
    toast.success("Draft deleted");
    refresh();
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Saved Drafts</h1>
          <p className="meta-text mt-1">
            Drafts are stored locally on this device. Resume where you left off, or discard drafts you no longer need.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/submit"><FileEdit className="h-4 w-4 mr-1" /> New Report</Link>
        </Button>
      </div>

      {drafts === null ? (
        <LoadingState label="Loading drafts…" />
      ) : drafts.length === 0 ? (
        <div className="dash-card text-center py-12">
          <Inbox className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No saved drafts on this device.</p>
          <Button className="mt-4" onClick={() => navigate("/submit")}>Start a new report</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((d) => (
            <div key={d.id} className="dash-card flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground truncate">{summarize(d)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Last saved {new Date(d.updatedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => remove(d.id)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
                <Button size="sm" onClick={() => navigate("/submit")}>
                  Resume <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
