import { buildJobSlug, slugifySegment } from "@domains/jobs/job-slug.util";

describe("job-slug.util", () => {
  it("slugifySegment normalizes text", () => {
    expect(slugifySegment("Forklift Operator!")).toBe("forklift-operator");
  });

  it("buildJobSlug combines title city state", () => {
    expect(buildJobSlug("Reach Truck", "Dallas", "TX")).toBe("reach-truck-dallas-tx");
  });
});
