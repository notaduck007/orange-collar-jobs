import { Badge } from "@/components/ui/badge";
import { jobSourceBadgeCategory, jobSourceLabel } from "@/lib/jobs/source-badge";

const BADGE_CLASS: Record<ReturnType<typeof jobSourceBadgeCategory>, string> = {
  direct: "bg-emerald-100 text-emerald-900 hover:bg-emerald-100",
  scraped: "bg-amber-100 text-amber-900 hover:bg-amber-100",
  batch: "bg-sky-100 text-sky-900 hover:bg-sky-100",
};

export function JobSourceBadge({ sourceType }: { sourceType?: string | null }) {
  const category = jobSourceBadgeCategory(sourceType ?? "direct");
  return (
    <Badge variant="secondary" className={BADGE_CLASS[category]}>
      {jobSourceLabel(sourceType ?? "direct")}
    </Badge>
  );
}
