import { useState } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import { isAsyncBatchResponse } from "@/lib/api/batch-api";
import type { BatchJobItem } from "@/lib/api/contracts/batch";

const SAMPLE_JOBS: BatchJobItem[] = [
  {
    externalId: `diag-${Date.now()}`,
    title: "Diagnostics Batch Picker",
    location: "Dallas, TX",
    city: "Dallas",
    state: "TX",
    employmentType: "full_time",
    shift: "first",
    description: "Dev panel sample batch job for FE-4 validation.",
    sourceType: "scraped",
  },
];

export function BatchIngestPanel() {
  const [apiKey, setApiKey] = useState("");
  const [batchId, setBatchId] = useState("");
  const [log, setLog] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [polling, setPolling] = useState(false);

  const appendLog = (label: string, body: unknown) => {
    setLog(`${label}\n${JSON.stringify(body, null, 2)}`);
  };

  const submit = async () => {
    setStatus("idle");
    setLog(null);
    if (!apiKey.trim()) {
      setLog("Paste your batch X-Api-Key first.");
      setStatus("error");
      return;
    }
    try {
      const result = await apiClient.submitBatch(apiKey.trim(), { jobs: SAMPLE_JOBS });
      appendLog("POST /api/v1/jobs/batch", result);
      setStatus("ok");
      if (isAsyncBatchResponse(result)) {
        setBatchId(result.batchId);
      } else {
        setBatchId(result.batchId);
      }
    } catch (err) {
      appendLog(
        "Error",
        err instanceof ApiError ? { status: err.statusCode, body: err.body } : String(err),
      );
      setStatus("error");
    }
  };

  const poll = async () => {
    if (!apiKey.trim() || !batchId.trim()) return;
    setPolling(true);
    try {
      const result = await apiClient.getBatchStatus(apiKey.trim(), batchId.trim());
      appendLog("GET /api/v1/jobs/batch/{batchId}/status", result);
      setStatus("ok");
    } catch (err) {
      appendLog(
        "Error",
        err instanceof ApiError ? { status: err.statusCode, body: err.body } : String(err),
      );
      setStatus("error");
    } finally {
      setPolling(false);
    }
  };

  return (
    <div
      data-testid="batch-ingest-panel"
      className="rounded-xl border border-border bg-card p-5 shadow-sm"
    >
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Batch Ingest · POST /api/v1/jobs/batch
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Paste a partner API key, submit a one-item sample batch, then poll status. Dev-only —
        production builds hide this route.
      </p>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">X-Api-Key</label>
      <input
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="wj_batch_…"
        className="mb-3 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Submit sample batch
        </button>
        <input
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          placeholder="batch UUID"
          className="min-w-[200px] flex-1 rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
        />
        <button
          type="button"
          onClick={() => void poll()}
          disabled={polling || !batchId.trim()}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {polling ? "Polling…" : "Poll status"}
        </button>
      </div>
      {log && (
        <pre
          className={`mt-3 max-h-64 overflow-auto rounded-md p-3 font-mono text-xs ${
            status === "ok" ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"
          }`}
        >
          {log}
        </pre>
      )}
    </div>
  );
}
