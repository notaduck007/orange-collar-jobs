import { resolve } from "node:path";
import { ApiContractService, OpenApiSpecLoader } from "@domains/api-contract";
import { AppModule } from "../../src/app.module.js";
import { createTestApp } from "../helpers/create-test-app.js";

const SPEC_PATH = resolve(process.cwd(), "../../docs/api/openapi.yaml");

describe("API contract drift (integration)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    testApp = await createTestApp(AppModule, 60_000);
  }, 70_000);

  afterAll(async () => {
    await testApp.close();
  });

  it("implemented routes match docs/api/openapi.yaml exactly", () => {
    const contract = testApp.app.get(ApiContractService);
    const loader = testApp.app.get(OpenApiSpecLoader);
    const report = contract.diff(
      contract.extractRouteSurface(),
      loader.loadFromFile(SPEC_PATH, { implementedOnly: true }),
    );

    expect(report.addedRoutes).toEqual([]);
    expect(report.removedRoutes).toEqual([]);
    expect(report.changedRoutes).toEqual([]);
    expect(report.hasDrift).toBe(false);
    expect(report.codeFingerprint).toBe(report.specFingerprint);
  });
});
