import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { OpenApiSpecLoader } from "@domains/api-contract/openapi-spec.loader";

const SAMPLE = `
openapi: 3.0.3
info:
  title: Sample
  version: 1.0.0
paths:
  /api/v1/jobs:
    get:
      x-implemented: true
      responses:
        '200':
          description: ok
    post:
      responses:
        '201':
          description: created
  /api/v1/jobs/{slug}:
    get:
      x-implemented: true
      responses:
        '200':
          description: ok
`;

describe("OpenApiSpecLoader", () => {
  const loader = new OpenApiSpecLoader();

  it("includes only x-implemented operations by default", () => {
    const routes = loader.parse(SAMPLE);
    const keys = routes.map((route) => `${route.method} ${route.path}`).sort();
    expect(keys).toEqual(["GET /api/v1/jobs", "GET /api/v1/jobs/{}"]);
  });

  it("can include all operations when implementedOnly is false", () => {
    const routes = loader.parse(SAMPLE, { implementedOnly: false });
    expect(routes.map((r) => r.method)).toContain("POST");
  });

  it("loadFromFile reads and parses spec from disk", () => {
    const tmp = path.join(os.tmpdir(), `openapi-test-${Date.now()}.yaml`);
    fs.writeFileSync(tmp, SAMPLE);
    const routes = loader.loadFromFile(tmp);
    expect(routes.length).toBeGreaterThan(0);
    fs.unlinkSync(tmp);
  });

  it("skips null path entries and invalid operation nodes", () => {
    const yaml = `
openapi: 3.0.3
paths:
  /api/v1/empty:
  /api/v1/ok:
    get:
      x-implemented: true
      responses:
        '200':
          description: ok
    post: null
`;
    const routes = loader.parse(yaml);
    expect(routes).toEqual([expect.objectContaining({ method: "GET", path: "/api/v1/ok" })]);
  });
});
