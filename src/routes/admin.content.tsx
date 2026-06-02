import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Save, Eye, Edit3, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Markdown } from "@/components/markdown";

export const Route = createFileRoute("/admin/content")({
  head: () => ({ meta: [{ title: "Content — WarehouseJobs Admin" }] }),
  component: AdminContent,
});

type Page = {
  id: string;
  slug: string;
  title: string;
  body: string;
  meta_description: string | null;
  published: boolean;
  updated_at: string;
};
type Faq = {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  published: boolean;
};

function AdminContent() {
  const [tab, setTab] = useState("pages");
  return (
    <div className="space-y-4">
      <div>
        <p className="label-caps">Site content</p>
        <h1 className="mt-1 text-2xl font-bold text-[color:var(--ink)]">Pages & FAQ</h1>
        <p className="text-sm text-muted-foreground">Edit /about, /faq, /contact and FAQ items. Changes go live instantly.</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="faq">FAQ items</TabsTrigger>
        </TabsList>
        <TabsContent value="pages" className="mt-4"><PagesEditor /></TabsContent>
        <TabsContent value="faq" className="mt-4"><FaqEditor /></TabsContent>
      </Tabs>
    </div>
  );
}

function PagesEditor() {
  const qc = useQueryClient();
  const { data: pages = [] } = useQuery({
    queryKey: ["admin-site-pages"],
    queryFn: async () => {
      const { data } = await supabase.from("site_pages").select("*").order("slug");
      return (data ?? []) as Page[];
    },
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId && pages.length) setSelectedId(pages[0].id);
  }, [pages, selectedId]);
  const selected = pages.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <div className="space-y-1 rounded-lg border border-border bg-card p-2">
        {pages.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedId(p.id)}
            className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
              selectedId === p.id ? "bg-[color:var(--primary-tint)] font-semibold text-[color:var(--ink)]" : "hover:bg-muted"
            }`}
          >
            <span className="truncate">/{p.slug}</span>
            {!p.published && <span className="text-[10px] uppercase text-muted-foreground">draft</span>}
          </button>
        ))}
        <NewPageButton onCreated={(id) => { qc.invalidateQueries({ queryKey: ["admin-site-pages"] }); setSelectedId(id); }} />
      </div>
      {selected && <PageForm key={selected.id} page={selected} onSaved={() => qc.invalidateQueries({ queryKey: ["admin-site-pages"] })} />}
    </div>
  );
}

function NewPageButton({ onCreated }: { onCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-3.5 w-3.5" /> New page
      </Button>
    );
  }
  return (
    <div className="space-y-2 rounded-md border border-border p-2">
      <Input placeholder="slug (e.g. terms)" value={slug} onChange={(e) => setSlug(e.target.value)} className="h-8" />
      <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-8" />
      <div className="flex gap-1">
        <Button size="sm" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={async () => {
            const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
            if (!cleanSlug || !title.trim()) return toast.error("Slug and title required");
            const { data, error } = await supabase
              .from("site_pages")
              .insert({ slug: cleanSlug, title: title.trim(), body: "", published: false })
              .select("id")
              .single();
            if (error) return toast.error(error.message);
            setOpen(false);
            setSlug("");
            setTitle("");
            onCreated(data.id);
          }}
        >Create</Button>
      </div>
    </div>
  );
}

function PageForm({ page, onSaved }: { page: Page; onSaved: () => void }) {
  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body);
  const [meta, setMeta] = useState(page.meta_description ?? "");
  const [published, setPublished] = useState(page.published);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("site_pages")
      .update({ title, body, meta_description: meta || null, published })
      .eq("id", page.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Page saved");
    onSaved();
  }
  async function remove() {
    if (!confirm(`Delete page /${page.slug}?`)) return;
    const { error } = await supabase.from("site_pages").delete().eq("id", page.id);
    if (error) return toast.error(error.message);
    toast.success("Page deleted");
    onSaved();
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs font-medium text-muted-foreground">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Published</span>
          <Switch checked={published} onCheckedChange={setPublished} />
        </div>
        <Link to={"/" + page.slug as any} target="_blank" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
          /{page.slug} <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Meta description (SEO)</label>
        <Input value={meta} onChange={(e) => setMeta(e.target.value)} className="mt-1" maxLength={200} />
      </div>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">Body (Markdown)</label>
        <div className="flex gap-1">
          <Button size="sm" variant={mode === "edit" ? "default" : "outline"} onClick={() => setMode("edit")}>
            <Edit3 className="mr-1.5 h-3.5 w-3.5" /> Edit
          </Button>
          <Button size="sm" variant={mode === "preview" ? "default" : "outline"} onClick={() => setMode("preview")}>
            <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview
          </Button>
        </div>
      </div>
      {mode === "edit" ? (
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={18} className="font-mono text-sm" />
      ) : (
        <div className="min-h-[300px] rounded-md border border-border bg-background p-4">
          <Markdown>{body || "_Nothing to preview yet._"}</Markdown>
        </div>
      )}
      <div className="flex justify-between">
        <Button variant="ghost" className="text-destructive" onClick={remove}>
          <Trash2 className="mr-1.5 h-4 w-4" /> Delete
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          Save
        </Button>
      </div>
    </div>
  );
}

function FaqEditor() {
  const qc = useQueryClient();
  const { data: faqs = [] } = useQuery({
    queryKey: ["admin-faq"],
    queryFn: async () => {
      const { data } = await supabase.from("faq_items").select("*").order("sort_order").order("created_at");
      return (data ?? []) as Faq[];
    },
  });

  async function patch(id: string, fields: Partial<Faq>) {
    const { error } = await supabase.from("faq_items").update(fields).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-faq"] });
  }
  async function move(f: Faq, dir: -1 | 1) {
    const idx = faqs.findIndex((x) => x.id === f.id);
    const other = faqs[idx + dir];
    if (!other) return;
    await Promise.all([
      supabase.from("faq_items").update({ sort_order: other.sort_order }).eq("id", f.id),
      supabase.from("faq_items").update({ sort_order: f.sort_order }).eq("id", other.id),
    ]);
    qc.invalidateQueries({ queryKey: ["admin-faq"] });
  }
  async function remove(f: Faq) {
    if (!confirm("Delete this FAQ item?")) return;
    const { error } = await supabase.from("faq_items").delete().eq("id", f.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-faq"] });
  }
  async function add() {
    const nextSort = (faqs[faqs.length - 1]?.sort_order ?? 0) + 10;
    const { error } = await supabase.from("faq_items").insert({
      question: "New question",
      answer: "",
      sort_order: nextSort,
      published: false,
    });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-faq"] });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{faqs.length} items</p>
        <Button size="sm" onClick={add}><Plus className="mr-1.5 h-4 w-4" /> Add item</Button>
      </div>
      <div className="space-y-3">
        {faqs.map((f, i) => (
          <FaqRow
            key={f.id}
            faq={f}
            canUp={i > 0}
            canDown={i < faqs.length - 1}
            onMoveUp={() => move(f, -1)}
            onMoveDown={() => move(f, 1)}
            onSave={(fields) => patch(f.id, fields)}
            onDelete={() => remove(f)}
          />
        ))}
        {faqs.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No FAQ items yet.</p>
        )}
      </div>
    </div>
  );
}

function FaqRow({
  faq, onSave, onDelete, onMoveUp, onMoveDown, canUp, canDown,
}: {
  faq: Faq;
  onSave: (f: Partial<Faq>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canUp: boolean;
  canDown: boolean;
}) {
  const [question, setQuestion] = useState(faq.question);
  const [answer, setAnswer] = useState(faq.answer);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const dirty = question !== faq.question || answer !== faq.answer;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!canUp} onClick={onMoveUp}>
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!canDown} onClick={onMoveDown}>
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} className="flex-1 font-semibold" placeholder="Question" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Live</span>
          <Switch checked={faq.published} onCheckedChange={(v) => onSave({ published: v })} />
        </div>
      </div>
      <div className="flex items-center justify-end gap-1">
        <Button size="sm" variant={mode === "edit" ? "default" : "outline"} onClick={() => setMode("edit")}>
          <Edit3 className="mr-1.5 h-3.5 w-3.5" /> Edit
        </Button>
        <Button size="sm" variant={mode === "preview" ? "default" : "outline"} onClick={() => setMode("preview")}>
          <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview
        </Button>
      </div>
      {mode === "edit" ? (
        <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} className="font-mono text-sm" placeholder="Answer (markdown supported)" />
      ) : (
        <div className="rounded-md border border-border bg-background p-3">
          <Markdown>{answer || "_Empty_"}</Markdown>
        </div>
      )}
      <div className="flex justify-between">
        <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
          <Trash2 className="mr-1.5 h-4 w-4" /> Delete
        </Button>
        <Button size="sm" disabled={!dirty} onClick={() => onSave({ question, answer })}>
          <Save className="mr-1.5 h-4 w-4" /> Save
        </Button>
      </div>
    </div>
  );
}
