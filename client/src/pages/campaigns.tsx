import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { EmailCampaign, EmailCampaignTemplate } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Send,
  Pencil,
  Loader2,
  FileText,
  Rocket,
  CalendarClock,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const msg = error.message;
    const braceIdx = msg.indexOf("{");
    if (braceIdx >= 0) {
      try {
        const parsed = JSON.parse(msg.slice(braceIdx));
        if (parsed?.message) return parsed.message;
      } catch {
        // not JSON — fall through
      }
    }
    const stripped = msg.replace(/^\d+:\s*/, "").trim();
    return stripped || fallback;
  }
  return fallback;
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function truncateId(id: string): string {
  if (!id) return "—";
  if (id.length <= 18) return id;
  return `${id.slice(0, 10)}…${id.slice(-4)}`;
}

interface CampaignFormState {
  campaignName: string;
  campaignType: string;
  documentId: string;
  documentId2: string;
  campaignInfoGid: string;
  mainScript: string;
  followUps: string[];
  expiryDate: string;
  notes: string;
}

function emptyCampaignState(): CampaignFormState {
  return {
    campaignName: "",
    campaignType: "",
    documentId: "",
    documentId2: "",
    campaignInfoGid: "",
    mainScript: "",
    followUps: [],
    expiryDate: "",
    notes: "",
  };
}

function stateFromCampaign(c: EmailCampaign): CampaignFormState {
  return {
    campaignName: c.campaignName ?? "",
    campaignType: c.campaignType ?? "",
    documentId: c.documentId ?? "",
    documentId2: c.documentId2 ?? "",
    campaignInfoGid: c.campaignInfoGid ?? "",
    mainScript: c.mainScript ?? "",
    followUps: c.followUps ?? [],
    expiryDate: c.expiryDate ?? "",
    notes: c.notes ?? "",
  };
}

function buildPayload(state: CampaignFormState) {
  return {
    campaignName: state.campaignName.trim(),
    campaignType: state.campaignType.trim() || null,
    documentId: state.documentId.trim(),
    documentId2: state.documentId2.trim() || null,
    campaignInfoGid: state.campaignInfoGid.trim(),
    mainScript: state.mainScript.trim() || null,
    followUps: state.followUps.map((f) => f.trim()).filter(Boolean),
    expiryDate: state.expiryDate || null,
    notes: state.notes.trim() || null,
  };
}

// ---------------------------------------------------------------------------
// Follow-ups editor (shared between campaign + template forms)
// ---------------------------------------------------------------------------
function FollowUpsEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="text-sm text-muted-foreground">No follow-up messages yet.</p>
      )}
      {value.map((f, i) => (
        <div key={i} className="flex gap-2 items-start">
          <Textarea
            value={f}
            onChange={(e) => {
              const next = [...value];
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder={`Follow-up message #${i + 1}`}
            rows={2}
            data-testid={`input-followup-${i}`}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
            data-testid={`button-remove-followup-${i}`}
            title="Remove follow-up"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...value, ""])}
        data-testid="button-add-followup"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add follow-up
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaign create/edit form
// ---------------------------------------------------------------------------
function CampaignForm({
  initial,
  templates,
  onSubmit,
  isPending,
  submitLabel,
}: {
  initial: EmailCampaign | null;
  templates: EmailCampaignTemplate[];
  onSubmit: (payload: ReturnType<typeof buildPayload>) => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const [state, setState] = useState<CampaignFormState>(
    initial ? stateFromCampaign(initial) : emptyCampaignState(),
  );
  const [error, setError] = useState<string>("");

  const update = (patch: Partial<CampaignFormState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  const applyTemplate = (templateId: string) => {
    const t = templates.find((tpl) => tpl.id === templateId);
    if (!t) return;
    update({
      campaignType: t.campaignType ?? "",
      documentId: t.documentId ?? "",
      documentId2: t.documentId2 ?? "",
      campaignInfoGid: t.campaignInfoGid ?? "",
      mainScript: t.defaultMainScript ?? "",
      followUps: t.defaultFollowUps ?? [],
      notes: t.notes ?? "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.campaignName.trim() || !state.documentId.trim() || !state.campaignInfoGid.trim()) {
      setError("Campaign name, Google Sheet Document ID and Campaign Info GID are required.");
      return;
    }
    setError("");
    onSubmit(buildPayload(state));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {templates.length > 0 && (
        <div className="space-y-1.5">
          <Label>Start from a template (optional)</Label>
          <Select onValueChange={applyTemplate}>
            <SelectTrigger data-testid="select-template">
              <SelectValue placeholder="Choose a template to prefill…" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="campaignName">Campaign name *</Label>
        <Input
          id="campaignName"
          value={state.campaignName}
          onChange={(e) => update({ campaignName: e.target.value })}
          placeholder="e.g. June Restaurant Outreach"
          data-testid="input-campaign-name"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="campaignType">Campaign type</Label>
        <Input
          id="campaignType"
          value={state.campaignType}
          onChange={(e) => update({ campaignType: e.target.value })}
          placeholder="e.g. cold-email"
          data-testid="input-campaign-type"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="documentId">Google Sheet Document ID *</Label>
          <Input
            id="documentId"
            value={state.documentId}
            onChange={(e) => update({ documentId: e.target.value })}
            placeholder="Spreadsheet ID"
            data-testid="input-document-id"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="documentId2">Second Document ID</Label>
          <Input
            id="documentId2"
            value={state.documentId2}
            onChange={(e) => update({ documentId2: e.target.value })}
            placeholder="Optional"
            data-testid="input-document-id-2"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="campaignInfoGid">Campaign Info tab GID *</Label>
        <Input
          id="campaignInfoGid"
          value={state.campaignInfoGid}
          onChange={(e) => update({ campaignInfoGid: e.target.value })}
          placeholder="The gid of the Campaign Info sheet tab"
          data-testid="input-campaign-info-gid"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mainScript">Main script</Label>
        <Textarea
          id="mainScript"
          value={state.mainScript}
          onChange={(e) => update({ mainScript: e.target.value })}
          placeholder="The first email message…"
          rows={4}
          data-testid="input-main-script"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Follow-up messages</Label>
        <FollowUpsEditor
          value={state.followUps}
          onChange={(followUps) => update({ followUps })}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="expiryDate">Expiry date</Label>
          <Input
            id="expiryDate"
            type="date"
            value={state.expiryDate}
            onChange={(e) => update({ expiryDate: e.target.value })}
            data-testid="input-expiry-date"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={state.notes}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="Internal notes (not sent)"
          rows={2}
          data-testid="input-notes"
        />
      </div>

      {error && <p className="text-sm text-destructive" data-testid="text-form-error">{error}</p>}

      <DialogFooter>
        <Button type="submit" disabled={isPending} data-testid="button-submit-campaign">
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Template create form
// ---------------------------------------------------------------------------
interface TemplateFormState {
  name: string;
  campaignType: string;
  documentId: string;
  documentId2: string;
  campaignInfoGid: string;
  defaultMainScript: string;
  defaultFollowUps: string[];
  notes: string;
}

function TemplateForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (payload: any) => void;
  isPending: boolean;
}) {
  const [state, setState] = useState<TemplateFormState>({
    name: "",
    campaignType: "",
    documentId: "",
    documentId2: "",
    campaignInfoGid: "",
    defaultMainScript: "",
    defaultFollowUps: [],
    notes: "",
  });
  const [error, setError] = useState("");

  const update = (patch: Partial<TemplateFormState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.name.trim() || !state.documentId.trim() || !state.campaignInfoGid.trim()) {
      setError("Template name, Google Sheet Document ID and Campaign Info GID are required.");
      return;
    }
    setError("");
    onSubmit({
      name: state.name.trim(),
      campaignType: state.campaignType.trim() || null,
      documentId: state.documentId.trim(),
      documentId2: state.documentId2.trim() || null,
      campaignInfoGid: state.campaignInfoGid.trim(),
      defaultMainScript: state.defaultMainScript.trim() || null,
      defaultFollowUps: state.defaultFollowUps.map((f) => f.trim()).filter(Boolean),
      notes: state.notes.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="tplName">Template name *</Label>
        <Input
          id="tplName"
          value={state.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="e.g. Restaurant cold email"
          data-testid="input-template-name"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tplType">Campaign type</Label>
        <Input
          id="tplType"
          value={state.campaignType}
          onChange={(e) => update({ campaignType: e.target.value })}
          placeholder="e.g. cold-email"
          data-testid="input-template-type"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="tplDoc">Google Sheet Document ID *</Label>
          <Input
            id="tplDoc"
            value={state.documentId}
            onChange={(e) => update({ documentId: e.target.value })}
            data-testid="input-template-document-id"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tplDoc2">Second Document ID</Label>
          <Input
            id="tplDoc2"
            value={state.documentId2}
            onChange={(e) => update({ documentId2: e.target.value })}
            placeholder="Optional"
            data-testid="input-template-document-id-2"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tplGid">Campaign Info tab GID *</Label>
        <Input
          id="tplGid"
          value={state.campaignInfoGid}
          onChange={(e) => update({ campaignInfoGid: e.target.value })}
          data-testid="input-template-gid"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tplScript">Default main script</Label>
        <Textarea
          id="tplScript"
          value={state.defaultMainScript}
          onChange={(e) => update({ defaultMainScript: e.target.value })}
          rows={4}
          data-testid="input-template-main-script"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Default follow-up messages</Label>
        <FollowUpsEditor
          value={state.defaultFollowUps}
          onChange={(defaultFollowUps) => update({ defaultFollowUps })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tplNotes">Notes</Label>
        <Textarea
          id="tplNotes"
          value={state.notes}
          onChange={(e) => update({ notes: e.target.value })}
          rows={2}
          data-testid="input-template-notes"
        />
      </div>

      {error && <p className="text-sm text-destructive" data-testid="text-template-error">{error}</p>}

      <DialogFooter>
        <Button type="submit" disabled={isPending} data-testid="button-submit-template">
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save template
        </Button>
      </DialogFooter>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Campaigns() {
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmailCampaign | null>(null);
  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [launchTarget, setLaunchTarget] = useState<EmailCampaign | null>(null);

  const { data: campaigns = [], isLoading } = useQuery<EmailCampaign[]>({
    queryKey: ["/api/email-campaigns"],
  });
  const { data: templates = [] } = useQuery<EmailCampaignTemplate[]>({
    queryKey: ["/api/email-campaign-templates"],
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/email-campaigns", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-campaigns"] });
      setFormOpen(false);
      setEditing(null);
      toast({ title: "Campaign created", description: "Your campaign is saved as a draft." });
    },
    onError: (error) => {
      toast({
        title: "Could not create campaign",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await apiRequest("PATCH", `/api/email-campaigns/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-campaigns"] });
      setFormOpen(false);
      setEditing(null);
      toast({ title: "Campaign updated" });
    },
    onError: (error) => {
      toast({
        title: "Could not update campaign",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const launchMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/email-campaigns/${id}/launch`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-campaigns"] });
      setLaunchTarget(null);
      toast({
        title: "Campaign launched",
        description: data?.message || "The workflow was triggered successfully.",
      });
    },
    onError: (error) => {
      setLaunchTarget(null);
      toast({
        title: "Launch failed",
        description: getErrorMessage(error, "The workflow could not be triggered."),
        variant: "destructive",
      });
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/email-campaign-templates", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-campaign-templates"] });
      setTemplateFormOpen(false);
      toast({ title: "Template saved" });
    },
    onError: (error) => {
      toast({
        title: "Could not save template",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (campaign: EmailCampaign) => {
    setEditing(campaign);
    setFormOpen(true);
  };

  const handleFormSubmit = (payload: any) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Send className="h-6 w-6" />
            Campaigns
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Launch cold-email campaigns through your automation workflow.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setTemplateFormOpen(true)}
            data-testid="button-new-template"
          >
            <FileText className="h-4 w-4 mr-2" />
            New template
          </Button>
          <Button onClick={openNew} data-testid="button-new-campaign">
            <Plus className="h-4 w-4 mr-2" />
            New campaign
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading campaigns…
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Send className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No campaigns yet</p>
            <p className="text-muted-foreground text-sm mt-1 mb-4">
              Create your first campaign to get started.
            </p>
            <Button onClick={openNew} data-testid="button-new-campaign-empty">
              <Plus className="h-4 w-4 mr-2" />
              New campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((c) => {
            const isLaunching = launchMutation.isPending && launchMutation.variables === c.id;
            return (
              <Card key={c.id} data-testid={`card-campaign-${c.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base" data-testid={`text-campaign-name-${c.id}`}>
                      {c.campaignName}
                    </CardTitle>
                    <Badge variant={c.status === "launched" ? "default" : "secondary"}>
                      {c.status === "launched" ? "Launched" : "Draft"}
                    </Badge>
                  </div>
                  {c.campaignType && (
                    <Badge variant="outline" className="w-fit mt-1">
                      {c.campaignType}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Document ID</span>
                    <span className="font-mono" title={c.documentId}>
                      {truncateId(c.documentId)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Follow-ups</span>
                    <span>{c.followUps?.length ?? 0}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Expiry</span>
                    <span>{formatDate(c.expiryDate)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" />
                      Last launched
                    </span>
                    <span>{formatDate(c.lastLaunchedAt)}</span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => setLaunchTarget(c)}
                      disabled={isLaunching}
                      data-testid={`button-launch-${c.id}`}
                    >
                      {isLaunching ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Rocket className="h-4 w-4 mr-2" />
                      )}
                      {c.status === "launched" ? "Re-launch" : "Launch"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(c)}
                      data-testid={`button-edit-${c.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / edit campaign dialog */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit campaign" : "New campaign"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the details for this campaign."
                : "Fill in the details. The campaign is saved as a draft until you launch it."}
            </DialogDescription>
          </DialogHeader>
          <CampaignForm
            key={editing?.id ?? "new"}
            initial={editing}
            templates={templates}
            onSubmit={handleFormSubmit}
            isPending={createMutation.isPending || updateMutation.isPending}
            submitLabel={editing ? "Save changes" : "Create campaign"}
          />
        </DialogContent>
      </Dialog>

      {/* New template dialog */}
      <Dialog open={templateFormOpen} onOpenChange={setTemplateFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New template</DialogTitle>
            <DialogDescription>
              Templates prefill the campaign form so you don't re-enter the same details.
            </DialogDescription>
          </DialogHeader>
          <TemplateForm
            onSubmit={(payload) => createTemplateMutation.mutate(payload)}
            isPending={createTemplateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Launch confirmation */}
      <AlertDialog
        open={!!launchTarget}
        onOpenChange={(open) => {
          if (!open) setLaunchTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {launchTarget?.status === "launched" ? "Re-launch this campaign?" : "Launch this campaign?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will trigger the live email workflow for{" "}
              <strong>{launchTarget?.campaignName}</strong>. Make sure the details are correct.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-launch">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={launchMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (launchTarget) launchMutation.mutate(launchTarget.id);
              }}
              data-testid="button-confirm-launch"
            >
              {launchMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4 mr-2" />
              )}
              {launchTarget?.status === "launched" ? "Re-launch" : "Launch"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
