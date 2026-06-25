import type { JobSourceType } from "@/lib/jobs/types";

export type JobSourceBadgeCategory = "direct" | "scraped" | "batch";

export function jobSourceBadgeCategory(sourceType: string): JobSourceBadgeCategory {
  switch (sourceType as JobSourceType) {
    case "scraped":
      return "scraped";
    case "api":
    case "syndicated":
      return "batch";
    default:
      return "direct";
  }
}

export function jobSourceLabel(sourceType: string): string {
  switch (jobSourceBadgeCategory(sourceType)) {
    case "scraped":
      return "Scraped";
    case "batch":
      return "Batch";
    default:
      return "Direct";
  }
}
