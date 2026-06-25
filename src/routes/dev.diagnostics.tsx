/**
 * Developer Diagnostics Page — /dev/diagnostics
 *
 * Visual test dashboard for the NestJS API integration.
 * Shows live health status and allows manual API endpoint testing.
 *
 * Only accessible in development (NODE_ENV !== 'production').
 * Removed from the router in production builds via the route guard below.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { BatchIngestPanel } from "@/components/dev/batch-ingest-panel";
import { JobsDiagnosticsPanel } from "@/components/dev/jobs-diagnostics-panel";
import { NotificationsDiagnosticsPanel } from "@/components/dev/notifications-diagnostics-panel";
import { useApiHealth } from "@/hooks/use-api-health";
import { apiClient, ApiError } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/api/config";

export const Route = createFileRoute("/dev/diagnostics")({
  beforeLoad: () => {
    if (import.meta.env.PROD) {
      throw redirect({ to: "/", replace: true });
    }
  },
  component: DiagnosticsPage,
});

// ── Shared UI primitives ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "up" | "down" | "unknown" | "ok" | "error" }) {
  const isGood = status === "up" || status === "ok";
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        isGood ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800",
      ].join(" ")}
    >
      <span
        className={["h-1.5 w-1.5 rounded-full", isGood ? "bg-green-500" : "bg-red-500"].join(" ")}
      />
      {status}
    </span>
  );
}

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

// ── Health panel ─────────────────────────────────────────────────────────────

function HealthPanel() {
  const { data, isLoading, isError, error, dataUpdatedAt, refetch } = useApiHealth();

  return (
    <Card title="API Health  ·  GET /api/health">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isLoading && <span className="text-sm text-muted-foreground">Checking…</span>}
          {isError && <StatusBadge status="error" />}
          {data && <StatusBadge status={data.status} />}
          {data && (
            <span className="text-xs text-muted-foreground">
              Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
        <button
          onClick={() => void refetch()}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          Refresh
        </button>
      </div>

      {isError && (
        <p className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error?.message ?? "Could not reach the API. Is `bun run api:dev` running?"}
        </p>
      )}

      {data?.info && (
        <ul className="mt-4 space-y-2">
          {Object.entries(data.info).map(([key, val]) => (
            <li key={key} className="flex items-center justify-between text-sm">
              <span className="font-mono text-muted-foreground">{key}</span>
              <StatusBadge status={val.status} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ── Manual request tester ────────────────────────────────────────────────────

function MePanel() {
  const [token, setToken] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");

  const runRequest = async () => {
    setResult(null);
    setStatus("idle");
    try {
      const data = await apiClient.me(token);
      setResult(JSON.stringify(data, null, 2));
      setStatus("ok");
    } catch (err) {
      if (err instanceof ApiError) {
        setResult(`HTTP ${err.statusCode}\n${JSON.stringify(err.body, null, 2)}`);
      } else {
        setResult(String(err));
      }
      setStatus("error");
    }
  };

  return (
    <Card title="Auth Identity  ·  GET /api/v1/me">
      <p className="mb-3 text-sm text-muted-foreground">
        Paste a Bearer JWT and fire the request. Phase 2 will auto-populate this from the session.
      </p>
      <textarea
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="eyJhbGciOiJIUzI1NiJ9…"
        className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        rows={3}
      />
      <button
        onClick={() => void runRequest()}
        disabled={!token.trim()}
        className="mt-2 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        Send GET /api/v1/me
      </button>

      {result && (
        <div
          className={[
            "mt-3 rounded-md p-3",
            status === "ok" ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900",
          ].join(" ")}
        >
          <p className="mb-1 text-xs font-semibold uppercase">
            {status === "ok" ? "200 OK" : "Error"}
          </p>
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs">{result}</pre>
        </div>
      )}
    </Card>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

function DiagnosticsPage() {
  const apiBase = getApiBaseUrl();

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div>
        <p className="label-caps text-muted-foreground">Dev only</p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">API Diagnostics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visual integration tests for the NestJS API at{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{apiBase}</code>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Set <code className="rounded bg-muted px-1 py-0.5">VITE_API_BASE_URL</code> in{" "}
          <code className="rounded bg-muted px-1 py-0.5">.env</code> to change the target.
        </p>
      </div>

      <HealthPanel />
      <MePanel />
      <JobsDiagnosticsPanel />
      <BatchIngestPanel />
      <NotificationsDiagnosticsPanel />

      <div className="rounded-xl border border-border bg-muted/50 p-4 text-xs text-muted-foreground">
        <p className="font-medium">Phase 4 + 4.5 diagnostics</p>
        <ul className="mt-1 list-inside list-disc space-y-1">
          <li>Jobs search + detail panels (FE-3)</li>
          <li>Batch ingest + status poll with X-Api-Key (FE-4)</li>
          <li>Notifications inbox sync + read-all (FE-4.5)</li>
          <li>Login at /auth stores Nest JWT for protected routes</li>
        </ul>
      </div>
    </main>
  );
}
