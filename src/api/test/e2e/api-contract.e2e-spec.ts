import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse, stringify } from "yaml";
import { detectContractDrift } from "@domains/api-contract/detect-contract-drift";

const REAL_SPEC = resolve(process.cwd(), "../../docs/api/openapi.yaml");

describe("API contract guard pipeline (e2e)", () => {
  it("exits clean (no drift) against the committed spec", async () => {
    const report = await detectContractDrift(REAL_SPEC);
    expect(report.hasDrift).toBe(false);
  }, 30_000);

  it("detects drift when the spec declares an unimplemented route", async () => {
    const document = parse(readFileSync(REAL_SPEC, "utf8")) as {
      paths: Record<string, unknown>;
    };
    document.paths["/__contract_guard_probe__"] = {
      get: { "x-implemented": true, responses: { "200": { description: "probe" } } },
    };

    const dir = mkdtempSync(join(tmpdir(), "contract-guard-"));
    const tamperedSpec = join(dir, "openapi.yaml");
    writeFileSync(tamperedSpec, stringify(document));

    try {
      const report = await detectContractDrift(tamperedSpec);
      expect(report.hasDrift).toBe(true);
      expect(report.removedRoutes.some((route) => route.path === "/__contract_guard_probe__")).toBe(
        true,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
