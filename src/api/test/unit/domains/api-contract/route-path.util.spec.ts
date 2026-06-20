import { joinRoutePath, normalizeRoutePath } from "@domains/api-contract/route-path.util";

describe("route-path.util", () => {
  it("joinRoutePath collapses segments", () => {
    expect(joinRoutePath("api", "v1", "jobs")).toBe("/api/v1/jobs");
  });

  it("normalizeRoutePath handles Nest and OpenAPI params", () => {
    expect(normalizeRoutePath("/api/v1/jobs/:id")).toEqual({
      path: "/api/v1/jobs/{}",
      params: ["id"],
    });
    expect(normalizeRoutePath("/api/v1/jobs/{slug}")).toEqual({
      path: "/api/v1/jobs/{}",
      params: ["slug"],
    });
  });
});
