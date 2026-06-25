import type { JobDetail } from "@/lib/api/contracts/jobs";
import { ApiError, apiClient } from "@/lib/api-client";
import { requireAccessToken } from "@/lib/api/require-access-token";
import { buildCreateJobFromEmployerForm } from "@/lib/jobs/employer-job-payload";
import type { EmployerJobFormSlice, ScreeningQuestionInput } from "@/lib/jobs/types";

export async function publishEmployerJobViaApi(
  form: EmployerJobFormSlice,
  options: {
    companyPackageId: string;
    featured?: boolean;
    screeningQuestions?: ScreeningQuestionInput[];
  },
): Promise<JobDetail> {
  const token = requireAccessToken();
  const body = buildCreateJobFromEmployerForm(form, {
    companyPackageId: options.companyPackageId,
    featured: options.featured,
    screeningQuestions: options.screeningQuestions,
  });
  try {
    return await apiClient.createJob(token, body);
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 402) {
      throw new Error("Insufficient job credits — purchase a package to post.");
    }
    throw err;
  }
}
