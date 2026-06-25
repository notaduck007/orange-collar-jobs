import { useState } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import { mapJobSummaryToCard } from "@/lib/jobs/job-mappers";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </div>
  );
}

export function JobsDiagnosticsPanel() {
  const [query, setQuery] = useState("");
  const [slug, setSlug] = useState("");
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [detailResult, setDetailResult] = useState<string | null>(null);
  const [searchStatus, setSearchStatus] = useState<"idle" | "ok" | "error">("idle");
  const [detailStatus, setDetailStatus] = useState<"idle" | "ok" | "error">("idle");

  const runSearch = async () => {
    setSearchResult(null);
    setSearchStatus("idle");
    try {
      const res = await apiClient.searchJobs({ q: query || undefined, pageSize: 5 });
      const cards = res.data.map(mapJobSummaryToCard);
      setSearchResult(JSON.stringify({ meta: res.meta, jobs: cards }, null, 2));
      setSearchStatus("ok");
    } catch (err) {
      setSearchResult(err instanceof ApiError ? JSON.stringify(err.body, null, 2) : String(err));
      setSearchStatus("error");
    }
  };

  const runDetail = async () => {
    setDetailResult(null);
    setDetailStatus("idle");
    try {
      const job = await apiClient.getJobBySlug(slug.trim());
      setDetailResult(JSON.stringify(job, null, 2));
      setDetailStatus("ok");
    } catch (err) {
      setDetailResult(err instanceof ApiError ? JSON.stringify(err.body, null, 2) : String(err));
      setDetailStatus("error");
    }
  };

  return (
    <Card title="Jobs API  ·  GET /api/v1/jobs + GET /api/v1/jobs/{slug}">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Search query
          </label>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="forklift"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void runSearch()}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              Search
            </button>
          </div>
          {searchResult && (
            <pre
              className={`mt-2 max-h-48 overflow-auto rounded-md p-3 font-mono text-xs ${
                searchStatus === "ok" ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"
              }`}
            >
              {searchResult}
            </pre>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Job slug</label>
          <div className="flex gap-2">
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="forklift-operator-austin-tx-abc123"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void runDetail()}
              disabled={!slug.trim()}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Fetch
            </button>
          </div>
          {detailResult && (
            <pre
              className={`mt-2 max-h-64 overflow-auto rounded-md p-3 font-mono text-xs ${
                detailStatus === "ok" ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"
              }`}
            >
              {detailResult}
            </pre>
          )}
        </div>
      </div>
    </Card>
  );
}
