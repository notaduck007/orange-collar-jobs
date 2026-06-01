import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileDown, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "./seeker.index";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/seeker/applications")({
  head: () => ({ meta: [{ title: "My Applications — WarehouseJobs" }] }),
  component: ApplicationsPage,
});

function ApplicationsPage() {
  const { user } = useAuth();

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["seeker-apps", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("applications")
        .select("id, status, created_at, cover_letter, resume_url, jobs(slug, title, location, shift, companies(name, logo_url))")
        .eq("applicant_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const downloadResume = async (path: string) => {
    const { data } = await supabase.storage.from("resumes").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="label-caps text-primary">Applications</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[color:var(--ink)]">My applications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {apps.length} total · employer status updates appear here
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : apps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-base font-semibold text-[color:var(--ink)]">No applications yet</p>
          <p className="mt-1 text-sm text-muted-foreground">When you apply to a job, it shows up here.</p>
          <Button asChild className="btn-primary mt-4">
            <Link to="/jobs">Search warehouse jobs</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Job</th>
                <th className="px-4 py-3 font-semibold">Applied</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Resume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {apps.map((app: any) => (
                <tr key={app.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      to="/jobs/$slug"
                      params={{ slug: app.jobs?.slug ?? "" }}
                      className="font-semibold text-[color:var(--ink)] hover:text-primary"
                    >
                      {app.jobs?.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{app.jobs?.companies?.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {app.jobs?.location}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(app.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="px-4 py-3">
                    {app.resume_url ? (
                      <button
                        onClick={() => downloadResume(app.resume_url)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        <FileDown className="h-3 w-3" /> Download
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
