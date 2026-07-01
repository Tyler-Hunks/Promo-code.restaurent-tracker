import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  type EmailCampaign,
  type EmailCampaignTemplate,
  type EmailCampaignLaunch,
  extractPlaceholders,
  isKnownPlaceholder,
  buildLaunchPayload,
  LIST_LABELS,
} from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Copy,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  History,
  Eye,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseError(error: unknown): { message: string; detail?: string } {
  if (error instanceof Error) {
    const msg = error.message;
    const braceIdx = msg.indexOf("{");
    if (braceIdx >= 0) {
      try {
        const parsed = JSON.parse(msg.slice(braceIdx));
        return { message: parsed?.message ?? msg, detail: parsed?.detail };
      } catch {
        // not JSON — fall through
      }
    }
    const stripped = msg.replace(/^\d+:\s*/, "").trim();
    return { message: stripped || "Something went wrong." };
  }
  return { message: "Something went wrong." };
}

function getErrorMessage(error: unknown, fallback: string): string {
  const { message } = parseError(error);
  return message || fallback;
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateLabel(value: string | Date): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "Unknown date";
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function truncateId(id: string): string {
  if (!id) return "—";
  if (id.length <= 18) return id;
  return `${id.slice(0, 10)}…${id.slice(-4)}`;
}

const PAGE_SIZE = 6;
const HISTORY_PAGE_SIZE = 15;

function paginate<T>(items: T[], page: number, size: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * size;
  return { safePage, pageCount, slice: items.slice(start, start + size) };
}

// ---------------------------------------------------------------------------
// Small reusable bits
// ---------------------------------------------------------------------------
function Pager({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-4">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        data-testid="button-prev-page"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Prev
      </Button>
      <span className="text-sm text-muted-foreground" data-testid="text-page-indicator">
        Page {page} of {pageCount}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
        data-testid="button-next-page"
      >
        Next
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
  testId,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  testId: string;
}) {
  return (
    <div className="relative max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
        data-testid={testId}
      />
    </div>
  );
}

function PlaceholderChips({
  texts,
  testId = "placeholder-chips",
  emptyHint = true,
}: {
  texts: Array<string | null | undefined>;
  testId?: string;
  emptyHint?: boolean;
}) {
  const tokens = extractPlaceholders(texts);
  if (tokens.length === 0) {
    if (!emptyHint) return null;
    return (
      <p className="text-xs text-muted-foreground">
        No placeholders detected yet. Use {"{{ name }}"} style tokens and they'll show up here.
      </p>
    );
  }
  const unknown = tokens.filter((t) => !isKnownPlaceholder(t));
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5" data-testid={testId}>
        {tokens.map((t) => {
          const known = isKnownPlaceholder(t);
          return (
            <Badge
              key={t}
              variant={known ? "secondary" : "destructive"}
              className="font-mono text-xs"
              title={
                known
                  ? undefined
                  : "Not a recognised lead field — check the spelling or it won't be filled in."
              }
              data-testid={`chip-placeholder-${t}`}
            >
              {`{{${t}}}`}
            </Badge>
          );
        })}
      </div>
      {unknown.length > 0 && (
        <p className="text-xs text-destructive" data-testid={`${testId}-unknown-warning`}>
          Placeholders in red aren't recognised lead fields, so they won't be filled in — check the spelling.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main-script variants editor (A/B). Up to 2 variants, tied by position to the
// Sheet IDs: Variant A → "A YL", Variant B → "B NL". Each shows its own
// detected placeholders. Shared between campaign + template forms.
// ---------------------------------------------------------------------------
function MainScriptsEditor({
  value,
  onChange,
  idPrefix,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  idPrefix: string;
}) {
  // Always show at least Variant A so there's somewhere to type.
  const variants = value.length === 0 ? [""] : value;

  const setAt = (i: number, text: string) => {
    const next = [...variants];
    next[i] = text;
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {variants.map((v, i) => {
        const label = i === 0 ? "Variant A" : "Variant B";
        const sheetLabel = LIST_LABELS[i] ?? `Sheet #${i + 1}`;
        return (
          <div key={i} className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label
                htmlFor={`${idPrefix}-variant-${i}`}
                className="text-xs font-medium"
              >
                {label}{" "}
                <span className="text-muted-foreground font-normal">
                  → sends to Sheet “{sheetLabel}”
                </span>
              </Label>
              {i > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onChange(variants.filter((_, idx) => idx !== i))}
                  data-testid={`button-remove-variant-${i}`}
                  title="Remove Variant B"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Textarea
              id={`${idPrefix}-variant-${i}`}
              value={v}
              onChange={(e) => setAt(i, e.target.value)}
              placeholder={
                i === 0
                  ? "The first email message… use {{ name }} for variables."
                  : "The Variant B message (A/B test)… use {{ name }} for variables."
              }
              rows={4}
              data-testid={`input-main-script-${i}`}
            />
            <PlaceholderChips
              texts={[v]}
              testId={`placeholder-chips-variant-${i}`}
              emptyHint={false}
            />
          </div>
        );
      })}
      {variants.length < 2 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...variants, ""])}
          data-testid="button-add-variant"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Variant B
        </Button>
      )}
    </div>
  );
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
        <div key={i} className="rounded-md border p-3 space-y-2">
          <div className="flex gap-2 items-start">
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
          <PlaceholderChips
            texts={[f]}
            testId={`placeholder-chips-followup-${i}`}
            emptyHint={false}
          />
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
// Sheet IDs editor (the array of tab gids; campaign needs at least 2)
// ---------------------------------------------------------------------------
function SheetIdsEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="text-sm text-muted-foreground">No Sheet IDs yet.</p>
      )}
      {value.map((s, i) => {
        const trimmed = s.trim();
        const invalid = trimmed !== "" && !/^\d+$/.test(trimmed);
        const listLabel = LIST_LABELS[i] ?? `Sheet #${i + 1}`;
        return (
          <div key={i} className="flex gap-2 items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="shrink-0 font-mono text-xs">
                  {listLabel}
                </Badge>
                <Input
                  value={s}
                  onChange={(e) => {
                    const next = [...value];
                    next[i] = e.target.value;
                    onChange(next);
                  }}
                  placeholder={`gid for “${listLabel}”, e.g. 0`}
                  className={invalid ? "border-destructive" : ""}
                  data-testid={`input-sheetid-${i}`}
                />
              </div>
              {invalid && (
                <p className="text-xs text-destructive mt-1">
                  Must be a number — the gid from the sheet tab URL.
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              data-testid={`button-remove-sheetid-${i}`}
              title="Remove Sheet ID"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...value, ""])}
        data-testid="button-add-sheetid"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Sheet ID
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaign create/edit form
// ---------------------------------------------------------------------------
interface CampaignFormState {
  campaignName: string;
  campaignType: string;
  documentId: string;
  sheetIds: string[];
  mainScripts: string[];
  followUps: string[];
  expiryDate: string;
  notes: string;
}

// Trims variants and drops trailing empties, but keeps internal positions so
// Variant A stays at index 0 and Variant B at index 1 (pairing with the sheets).
function normalizeVariants(variants: string[]): string[] {
  const out = variants.map((s) => s.trim());
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out;
}

function emptyCampaignState(): CampaignFormState {
  return {
    campaignName: "",
    campaignType: "",
    documentId: "",
    sheetIds: ["", ""],
    mainScripts: [""],
    followUps: [],
    expiryDate: "",
    notes: "",
  };
}

function stateFromCampaign(c: EmailCampaign): CampaignFormState {
  const sheetIds = c.sheetIds && c.sheetIds.length > 0 ? [...c.sheetIds] : ["", ""];
  const mainScripts = c.mainScripts && c.mainScripts.length > 0 ? [...c.mainScripts] : [""];
  return {
    campaignName: c.campaignName ?? "",
    campaignType: c.campaignType ?? "",
    documentId: c.documentId ?? "",
    sheetIds,
    mainScripts,
    followUps: c.followUps ?? [],
    expiryDate: c.expiryDate ?? "",
    notes: c.notes ?? "",
  };
}

function buildCampaignPayload(state: CampaignFormState) {
  return {
    campaignName: state.campaignName.trim(),
    campaignType: state.campaignType.trim() || null,
    documentId: state.documentId.trim(),
    sheetIds: state.sheetIds.map((s) => s.trim()).filter(Boolean),
    mainScripts: normalizeVariants(state.mainScripts),
    followUps: state.followUps.map((f) => f.trim()).filter(Boolean),
    expiryDate: state.expiryDate.trim() || null,
    notes: state.notes.trim() || null,
  };
}

function CampaignForm({
  initial,
  templates,
  onSubmit,
  isPending,
  submitLabel,
}: {
  initial: EmailCampaign | null;
  templates: EmailCampaignTemplate[];
  onSubmit: (payload: ReturnType<typeof buildCampaignPayload>) => void;
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
      sheetIds: t.sheetIds && t.sheetIds.length > 0 ? [...t.sheetIds] : ["", ""],
      mainScripts:
        t.defaultMainScripts && t.defaultMainScripts.length > 0
          ? [...t.defaultMainScripts]
          : [""],
      followUps: t.defaultFollowUps ?? [],
      notes: t.notes ?? "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = state.campaignName.trim();
    const doc = state.documentId.trim();
    const sheetIds = state.sheetIds.map((s) => s.trim()).filter(Boolean);

    if (!name) {
      setError("Campaign name is required.");
      return;
    }
    if (!doc) {
      setError("Google Sheet Document ID is required.");
      return;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(doc)) {
      setError("Document ID should be just the ID from the URL (letters, numbers, - and _).");
      return;
    }
    if (sheetIds.length < 2) {
      setError("Add at least 2 Sheet IDs (gids).");
      return;
    }
    if (sheetIds.some((s) => !/^\d+$/.test(s))) {
      setError("Each Sheet ID (gid) must be a number, e.g. 0 or 123456789.");
      return;
    }
    const variants = normalizeVariants(state.mainScripts);
    if (variants.length === 0) {
      setError("Add at least the Variant A main script.");
      return;
    }
    if (variants.some((v) => v === "")) {
      setError("Variant A can't be empty when Variant B is filled in. Fill in Variant A or remove Variant B.");
      return;
    }
    const expiry = state.expiryDate.trim();
    if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
      setError("Expiry date must be in YYYY-MM-DD format, e.g. 2026-12-31, or left blank.");
      return;
    }
    setError("");
    onSubmit(buildCampaignPayload(state));
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

      <div className="space-y-1.5">
        <Label htmlFor="documentId">Google Sheet Document ID *</Label>
        <Input
          id="documentId"
          value={state.documentId}
          onChange={(e) => update({ documentId: e.target.value })}
          placeholder="The long ID from the spreadsheet URL"
          data-testid="input-document-id"
        />
        <p className="text-xs text-muted-foreground">
          From the sheet URL: docs.google.com/spreadsheets/d/<strong>DOCUMENT_ID</strong>/edit
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Sheet IDs (tab gids) *</Label>
        <p className="text-xs text-muted-foreground">
          Add at least 2 tab gids from the same document. The gid is the number after
          <span className="font-mono"> #gid=</span> in the tab URL.
        </p>
        <SheetIdsEditor
          value={state.sheetIds}
          onChange={(sheetIds) => update({ sheetIds })}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Main script (A/B variants)</Label>
        <p className="text-xs text-muted-foreground">
          Variant A always sends. Add Variant B to A/B test — it sends to the second
          sheet ("{LIST_LABELS[1]}") while Variant A sends to the first ("{LIST_LABELS[0]}").
        </p>
        <MainScriptsEditor
          value={state.mainScripts}
          onChange={(mainScripts) => update({ mainScripts })}
          idPrefix="campaign"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Follow-up messages (shared by both variants)</Label>
        <FollowUpsEditor
          value={state.followUps}
          onChange={(followUps) => update({ followUps })}
        />
      </div>

      <div className="space-y-1.5 rounded-md border p-3 bg-muted/30">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          All placeholders detected (whole campaign)
        </Label>
        <PlaceholderChips texts={[...state.mainScripts, ...state.followUps]} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="expiryDate">Expiry date</Label>
        <Input
          id="expiryDate"
          type="text"
          inputMode="numeric"
          value={state.expiryDate}
          onChange={(e) => update({ expiryDate: e.target.value })}
          placeholder="YYYY-MM-DD (leave blank for none)"
          data-testid="input-expiry-date"
        />
        <p className="text-xs text-muted-foreground">
          Type a date like 2026-12-31, or leave blank. It's sent as a Unix timestamp
          (seconds).
        </p>
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

      {error && (
        <p className="text-sm text-destructive" data-testid="text-form-error">
          {error}
        </p>
      )}

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
  sheetIds: string[];
  defaultMainScripts: string[];
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
    sheetIds: [],
    defaultMainScripts: [""],
    defaultFollowUps: [],
    notes: "",
  });
  const [error, setError] = useState("");

  const update = (patch: Partial<TemplateFormState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = state.name.trim();
    const doc = state.documentId.trim();
    const sheetIds = state.sheetIds.map((s) => s.trim()).filter(Boolean);

    if (!name) {
      setError("Template name is required.");
      return;
    }
    if (doc && !/^[A-Za-z0-9_-]+$/.test(doc)) {
      setError("Document ID should be just the ID from the URL (letters, numbers, - and _).");
      return;
    }
    if (sheetIds.some((s) => !/^\d+$/.test(s))) {
      setError("Each Sheet ID (gid) must be a number.");
      return;
    }
    const defaultMainScripts = normalizeVariants(state.defaultMainScripts);
    if (defaultMainScripts.some((v) => v === "")) {
      setError("Variant A can't be empty when Variant B is filled in. Fill in Variant A or remove Variant B.");
      return;
    }
    setError("");
    onSubmit({
      name,
      campaignType: state.campaignType.trim() || null,
      documentId: doc || null,
      sheetIds,
      defaultMainScripts,
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
      <div className="space-y-1.5">
        <Label htmlFor="tplDoc">Google Sheet Document ID</Label>
        <Input
          id="tplDoc"
          value={state.documentId}
          onChange={(e) => update({ documentId: e.target.value })}
          placeholder="Optional — leave blank to reuse just the scripts"
          data-testid="input-template-document-id"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Sheet IDs (tab gids)</Label>
        <p className="text-xs text-muted-foreground">Optional defaults for new campaigns.</p>
        <SheetIdsEditor
          value={state.sheetIds}
          onChange={(sheetIds) => update({ sheetIds })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Default main script (A/B variants)</Label>
        <MainScriptsEditor
          value={state.defaultMainScripts}
          onChange={(defaultMainScripts) => update({ defaultMainScripts })}
          idPrefix="template"
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

      {error && (
        <p className="text-sm text-destructive" data-testid="text-template-error">
          {error}
        </p>
      )}

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
// Launch payload preview — uses the exact same builder the server does, so the
// preview always matches what n8n receives (minus the auto-added triggeredAt).
// ---------------------------------------------------------------------------
function previewPayload(c: EmailCampaign) {
  return buildLaunchPayload(c);
}

interface LaunchResult {
  ok: boolean;
  campaignName: string;
  message: string;
  detail?: string;
}

interface CampaignRollup {
  campaignId: string;
  campaignName: string;
  total: number;
  success: number;
  failed: number;
  lastLaunchedAt: string | Date;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Campaigns() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("campaigns");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmailCampaign | null>(null);
  const [prefill, setPrefill] = useState<EmailCampaign | null>(null);
  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [launchTarget, setLaunchTarget] = useState<EmailCampaign | null>(null);
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null);
  const [selectedLaunch, setSelectedLaunch] = useState<EmailCampaignLaunch | null>(null);

  const [campaignSearch, setCampaignSearch] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [campaignPage, setCampaignPage] = useState(1);
  const [templatePage, setTemplatePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyView, setHistoryView] = useState<"launch" | "campaign">("launch");

  const { data: campaigns = [], isLoading } = useQuery<EmailCampaign[]>({
    queryKey: ["/api/email-campaigns"],
  });
  const { data: templates = [] } = useQuery<EmailCampaignTemplate[]>({
    queryKey: ["/api/email-campaign-templates"],
  });
  const { data: launches = [], isLoading: launchesLoading } = useQuery<EmailCampaignLaunch[]>({
    queryKey: ["/api/email-campaign-launches"],
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
      setPrefill(null);
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
      setPrefill(null);
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
      setLaunchResult({
        ok: true,
        campaignName: launchTarget?.campaignName ?? "",
        message: data?.message || "The workflow was triggered.",
        detail: data?.detail,
      });
    },
    onError: (error) => {
      const { message, detail } = parseError(error);
      setLaunchResult({
        ok: false,
        campaignName: launchTarget?.campaignName ?? "",
        message,
        detail,
      });
    },
    onSettled: () => {
      setLaunchTarget(null);
      queryClient.invalidateQueries({ queryKey: ["/api/email-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-campaign-launches"] });
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
    setPrefill(null);
    setFormOpen(true);
  };

  const openEdit = (campaign: EmailCampaign) => {
    setEditing(campaign);
    setPrefill(null);
    setFormOpen(true);
  };

  const openDuplicate = (campaign: EmailCampaign) => {
    setEditing(null);
    setPrefill({ ...campaign, campaignName: `${campaign.campaignName} (copy)` });
    setActiveTab("campaigns");
    setFormOpen(true);
  };

  const openFromTemplate = (t: EmailCampaignTemplate) => {
    setEditing(null);
    setPrefill({
      id: `template:${t.id}`,
      campaignName: "",
      campaignType: t.campaignType ?? null,
      documentId: t.documentId ?? "",
      sheetIds: t.sheetIds ?? [],
      mainScripts: t.defaultMainScripts ?? [],
      followUps: t.defaultFollowUps ?? [],
      expiryDate: null,
      notes: t.notes ?? null,
      status: "draft",
      lastLaunchedAt: null,
      createdAt: new Date(),
    });
    setActiveTab("campaigns");
    setFormOpen(true);
  };

  const handleFormSubmit = (payload: any) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const formInitial = editing ?? prefill;

  // ----- Derived lists -----
  const filteredCampaigns = useMemo(() => {
    const q = campaignSearch.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter(
      (c) =>
        c.campaignName.toLowerCase().includes(q) ||
        (c.campaignType ?? "").toLowerCase().includes(q) ||
        c.documentId.toLowerCase().includes(q),
    );
  }, [campaigns, campaignSearch]);

  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.campaignType ?? "").toLowerCase().includes(q),
    );
  }, [templates, templateSearch]);

  const filteredLaunches = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return launches;
    return launches.filter((l) => l.campaignName.toLowerCase().includes(q));
  }, [launches, historySearch]);

  const rollups = useMemo<CampaignRollup[]>(() => {
    const map = new Map<string, CampaignRollup>();
    for (const l of filteredLaunches) {
      let r = map.get(l.campaignId);
      if (!r) {
        r = {
          campaignId: l.campaignId,
          campaignName: l.campaignName,
          total: 0,
          success: 0,
          failed: 0,
          lastLaunchedAt: l.launchedAt,
        };
        map.set(l.campaignId, r);
      }
      r.total++;
      if (l.status === "success") r.success++;
      else r.failed++;
      if (new Date(l.launchedAt) > new Date(r.lastLaunchedAt)) {
        r.lastLaunchedAt = l.launchedAt;
        r.campaignName = l.campaignName;
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastLaunchedAt).getTime() - new Date(a.lastLaunchedAt).getTime(),
    );
  }, [filteredLaunches]);

  const campaignsPaged = paginate(filteredCampaigns, campaignPage, PAGE_SIZE);
  const templatesPaged = paginate(filteredTemplates, templatePage, PAGE_SIZE);
  const launchesPaged = paginate(filteredLaunches, historyPage, HISTORY_PAGE_SIZE);
  const rollupsPaged = paginate(rollups, historyPage, PAGE_SIZE);

  // Group the current page of launches under date headings (already newest-first).
  const launchGroups = useMemo(() => {
    const groups: { label: string; items: EmailCampaignLaunch[] }[] = [];
    for (const l of launchesPaged.slice) {
      const label = dateLabel(l.launchedAt);
      let g = groups.find((x) => x.label === label);
      if (!g) {
        g = { label, items: [] };
        groups.push(g);
      }
      g.items.push(l);
    }
    return groups;
  }, [launchesPaged.slice]);

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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="campaigns" data-testid="tab-campaigns">
            <Send className="h-4 w-4 mr-2" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">
            <FileText className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
        </TabsList>

        {/* ===================== CAMPAIGNS TAB ===================== */}
        <TabsContent value="campaigns" className="space-y-4">
          <SearchBox
            value={campaignSearch}
            onChange={(v) => {
              setCampaignSearch(v);
              setCampaignPage(1);
            }}
            placeholder="Search campaigns…"
            testId="input-search-campaigns"
          />

          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading campaigns…
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Send className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">
                  {campaigns.length === 0 ? "No campaigns yet" : "No matching campaigns"}
                </p>
                <p className="text-muted-foreground text-sm mt-1 mb-4">
                  {campaigns.length === 0
                    ? "Create your first campaign to get started."
                    : "Try a different search."}
                </p>
                {campaigns.length === 0 && (
                  <Button onClick={openNew} data-testid="button-new-campaign-empty">
                    <Plus className="h-4 w-4 mr-2" />
                    New campaign
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {campaignsPaged.slice.map((c) => {
                  const isLaunching =
                    launchMutation.isPending && launchMutation.variables === c.id;
                  const placeholders = extractPlaceholders([
                    ...(c.mainScripts ?? []),
                    ...(c.followUps ?? []),
                  ]);
                  return (
                    <Card key={c.id} data-testid={`card-campaign-${c.id}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle
                            className="text-base"
                            data-testid={`text-campaign-name-${c.id}`}
                          >
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
                          <span className="text-muted-foreground">Sheet IDs</span>
                          <span>{c.sheetIds?.length ?? 0}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Follow-ups</span>
                          <span>{c.followUps?.length ?? 0}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Placeholders</span>
                          <span>{placeholders.length}</span>
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
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openDuplicate(c)}
                            data-testid={`button-duplicate-${c.id}`}
                            title="Duplicate"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <Pager
                page={campaignsPaged.safePage}
                pageCount={campaignsPaged.pageCount}
                onPage={setCampaignPage}
              />
            </>
          )}
        </TabsContent>

        {/* ===================== HISTORY TAB ===================== */}
        <TabsContent value="history" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <SearchBox
              value={historySearch}
              onChange={(v) => {
                setHistorySearch(v);
                setHistoryPage(1);
              }}
              placeholder="Search by campaign name…"
              testId="input-search-history"
            />
            <div className="flex items-center rounded-md border p-0.5 w-fit">
              <Button
                size="sm"
                variant={historyView === "launch" ? "default" : "ghost"}
                onClick={() => {
                  setHistoryView("launch");
                  setHistoryPage(1);
                }}
                data-testid="button-history-by-launch"
              >
                By launch
              </Button>
              <Button
                size="sm"
                variant={historyView === "campaign" ? "default" : "ghost"}
                onClick={() => {
                  setHistoryView("campaign");
                  setHistoryPage(1);
                }}
                data-testid="button-history-by-campaign"
              >
                By campaign
              </Button>
            </div>
          </div>

          {launchesLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading history…
            </div>
          ) : filteredLaunches.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <History className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">
                  {launches.length === 0 ? "No launches yet" : "No matching launches"}
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                  {launches.length === 0
                    ? "Every time you launch a campaign it'll be recorded here."
                    : "Try a different search."}
                </p>
              </CardContent>
            </Card>
          ) : historyView === "launch" ? (
            <>
              <div className="space-y-5">
                {launchGroups.map((group) => (
                  <div key={group.label} className="space-y-2">
                    <h3
                      className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      data-testid={`history-date-${group.label}`}
                    >
                      {group.label}
                    </h3>
                    <div className="space-y-2">
                      {group.items.map((l) => (
                        <Card key={l.id} data-testid={`row-launch-${l.id}`}>
                          <CardContent className="py-3 flex items-center gap-3">
                            {l.status === "success" ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                            ) : (
                              <XCircle className="h-5 w-5 text-destructive shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{l.campaignName}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(l.launchedAt)}
                                {l.detail ? ` · ${l.detail}` : ""}
                              </p>
                            </div>
                            <Badge
                              variant={l.status === "success" ? "default" : "destructive"}
                              className="shrink-0"
                            >
                              {l.status}
                            </Badge>
                            {l.detail && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedLaunch(l)}
                                data-testid={`button-view-launch-${l.id}`}
                                title="View response"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <Pager
                page={launchesPaged.safePage}
                pageCount={launchesPaged.pageCount}
                onPage={setHistoryPage}
              />
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rollupsPaged.slice.map((r) => (
                  <Card key={r.campaignId} data-testid={`card-rollup-${r.campaignId}`}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base truncate">{r.campaignName}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Total launches</span>
                        <span className="font-medium">{r.total}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          Successful
                        </span>
                        <span>{r.success}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <XCircle className="h-3.5 w-3.5 text-destructive" />
                          Failed
                        </span>
                        <span>{r.failed}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Last launched</span>
                        <span>{formatDateTime(r.lastLaunchedAt)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Pager
                page={rollupsPaged.safePage}
                pageCount={rollupsPaged.pageCount}
                onPage={setHistoryPage}
              />
            </>
          )}
        </TabsContent>

        {/* ===================== TEMPLATES TAB ===================== */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <SearchBox
              value={templateSearch}
              onChange={(v) => {
                setTemplateSearch(v);
                setTemplatePage(1);
              }}
              placeholder="Search templates…"
              testId="input-search-templates"
            />
            <Button
              variant="outline"
              onClick={() => setTemplateFormOpen(true)}
              data-testid="button-new-template-tab"
            >
              <Plus className="h-4 w-4 mr-2" />
              New template
            </Button>
          </div>

          {filteredTemplates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">
                  {templates.length === 0 ? "No templates yet" : "No matching templates"}
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                  {templates.length === 0
                    ? "Templates prefill the campaign form so you don't re-enter the same details."
                    : "Try a different search."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templatesPaged.slice.map((t) => (
                  <Card key={t.id} data-testid={`card-template-${t.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{t.name}</CardTitle>
                        {t.campaignType && (
                          <Badge variant="outline">{t.campaignType}</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Document ID</span>
                        <span className="font-mono" title={t.documentId ?? ""}>
                          {t.documentId ? truncateId(t.documentId) : "—"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Sheet IDs</span>
                        <span>{t.sheetIds?.length ?? 0}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Follow-ups</span>
                        <span>{t.defaultFollowUps?.length ?? 0}</span>
                      </div>
                      <div className="pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => openFromTemplate(t)}
                          data-testid={`button-use-template-${t.id}`}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          New campaign from this
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Pager
                page={templatesPaged.safePage}
                pageCount={templatesPaged.pageCount}
                onPage={setTemplatePage}
              />
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Create / edit campaign dialog */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditing(null);
            setPrefill(null);
          }
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
            key={editing?.id ?? prefill?.id ?? "new"}
            initial={formInitial}
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

      {/* Launch confirmation with payload preview */}
      <AlertDialog
        open={!!launchTarget}
        onOpenChange={(open) => {
          if (!open) setLaunchTarget(null);
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {launchTarget?.status === "launched"
                ? "Re-launch this campaign?"
                : "Launch this campaign?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will trigger the live email workflow for{" "}
              <strong>{launchTarget?.campaignName}</strong>. Here's exactly what will be sent:
            </AlertDialogDescription>
          </AlertDialogHeader>
          {launchTarget && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Payload preview
              </Label>
              <ScrollArea className="h-56 rounded-md border bg-muted/40">
                <pre
                  className="p-3 text-xs font-mono whitespace-pre-wrap break-all"
                  data-testid="text-payload-preview"
                >
                  {JSON.stringify(previewPayload(launchTarget), null, 2)}
                </pre>
              </ScrollArea>
              <p className="text-xs text-muted-foreground">
                A <span className="font-mono">triggeredAt</span> timestamp is added automatically.
              </p>
            </div>
          )}
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

      {/* Launch result (n8n response) */}
      <Dialog
        open={!!launchResult}
        onOpenChange={(open) => {
          if (!open) setLaunchResult(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {launchResult?.ok ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              {launchResult?.ok ? "Campaign launched" : "Launch failed"}
            </DialogTitle>
            <DialogDescription>
              {launchResult?.campaignName}
              {launchResult?.message ? ` — ${launchResult.message}` : ""}
            </DialogDescription>
          </DialogHeader>
          {launchResult?.detail && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Response from your workflow
              </Label>
              <ScrollArea className="h-48 rounded-md border bg-muted/40">
                <pre
                  className="p-3 text-xs font-mono whitespace-pre-wrap break-all"
                  data-testid="text-launch-response"
                >
                  {launchResult.detail}
                </pre>
              </ScrollArea>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            This launch was saved to the History tab.
          </p>
          <DialogFooter>
            <Button onClick={() => setLaunchResult(null)} data-testid="button-close-result">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single launch detail */}
      <Dialog
        open={!!selectedLaunch}
        onOpenChange={(open) => {
          if (!open) setSelectedLaunch(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedLaunch?.status === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              {selectedLaunch?.campaignName}
            </DialogTitle>
            <DialogDescription>
              {formatDateTime(selectedLaunch?.launchedAt)} · {selectedLaunch?.status}
            </DialogDescription>
          </DialogHeader>
          {selectedLaunch?.detail ? (
            <ScrollArea className="h-56 rounded-md border bg-muted/40">
              <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all">
                {selectedLaunch.detail}
              </pre>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground">No response detail recorded.</p>
          )}
          <DialogFooter>
            <Button onClick={() => setSelectedLaunch(null)} data-testid="button-close-launch-detail">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
