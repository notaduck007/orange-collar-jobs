import { resolve } from "node:path";
import { detectContractDrift } from "@domains/api-contract/detect-contract-drift";

const SPEC_PATH = resolve(process.cwd(), "../../docs/api/openapi.yaml");

describe("API contract drift (integration)", () => {
  it("implemented routes match docs/api/openapi.yaml exactly", async () => {
    const report = await detectContractDrift(SPEC_PATH);

    expect(report.addedRoutes).toEqual([]);
    expect(report.removedRoutes).toEqual([]);
    expect(report.changedRoutes).toEqual([]);
    expect(report.hasDrift).toBe(false);
    expect(report.codeFingerprint).toBe(report.specFingerprint);
  }, 30_000);
});
