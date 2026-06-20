/**
 * CLI entry for API contract drift guard.
 * Usage: bun run contract:check [-- --spec path/to/openapi.yaml]
 */
import { resolve } from "node:path";
import { detectContractDrift } from "../src/domains/api-contract/detect-contract-drift.js";
import type { ContractDriftReport } from "../src/domains/api-contract/types.js";

const DEFAULT_SPEC_PATH = resolve(process.cwd(), "../../docs/api/openapi.yaml");

function parseSpecPath(argv: readonly string[]): string {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--spec" && argv[index + 1]) {
      return resolve(process.cwd(), argv[index + 1]);
    }
  }
  return DEFAULT_SPEC_PATH;
}

function printReport(report: ContractDriftReport, specPath: string): void {
  if (!report.hasDrift) {
    console.log(`API contract is in sync with ${specPath}.`);
    console.log(`  code fingerprint: ${report.codeFingerprint.slice(0, 12)}`);
    console.log(`  spec fingerprint: ${report.specFingerprint.slice(0, 12)}`);
    return;
  }

  console.error(`API contract drift detected against ${specPath}:\n`);
  for (const drift of report.addedRoutes) {
    console.error(`  [ADDED]   ${drift.detail}`);
  }
  for (const drift of report.removedRoutes) {
    console.error(`  [REMOVED] ${drift.detail}`);
  }
  for (const drift of report.changedRoutes) {
    console.error(`  [CHANGED] ${drift.detail}`);
  }
  console.error(
    [
      "",
      "Resolve drift before merging:",
      "  1. Update docs/api/openapi.yaml (mark implemented ops with x-implemented: true).",
      "  2. Re-run: bun run contract:check",
      "  3. Update Postman collection if HTTP surface changed.",
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  const specPath = parseSpecPath(process.argv.slice(2));
  const report = await detectContractDrift(specPath);
  printReport(report, specPath);
  if (report.hasDrift) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error("contract:check failed:", error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
