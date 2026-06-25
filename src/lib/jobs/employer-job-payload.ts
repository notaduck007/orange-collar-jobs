import type { CreateJobRequest } from "@/lib/api/contracts/jobs";
import type {
  EmployerJobFormSlice,
  EmploymentType,
  JobShift,
  ScreeningQuestionInput,
} from "@/lib/jobs/types";

/** Build OpenAPI CreateJobRequest from employer wizard form state. */
export function buildCreateJobFromEmployerForm(
  form: EmployerJobFormSlice,
  options: {
    companyPackageId: string;
    status?: CreateJobRequest["status"];
    featured?: boolean;
    screeningQuestions?: ScreeningQuestionInput[];
  },
): CreateJobRequest {
  const locationStr = `${form.city}, ${form.state.toUpperCase()}${form.zip ? ` ${form.zip}` : ""}`;
  return {
    title: form.title.trim(),
    category: form.category.trim(),
    location: locationStr,
    city: form.city.trim(),
    state: form.state.trim().toUpperCase(),
    zip: form.zip || undefined,
    employmentType: form.employment_type as EmploymentType,
    shift: form.shift as JobShift,
    payMin: form.pay_min ? Number(form.pay_min) : undefined,
    payMax: form.pay_max ? Number(form.pay_max) : undefined,
    payPeriod: form.pay_period,
    description: form.description.trim(),
    requirements: form.requirements.trim() || undefined,
    temperatureEnv: (form.temperature_env || undefined) as CreateJobRequest["temperatureEnv"],
    certificationsRequired: form.certifications_required,
    liftRequirementLbs: form.lift_requirement_lbs ? Number(form.lift_requirement_lbs) : undefined,
    overtimeAvailable: form.overtime_available,
    weeklyPay: form.weekly_pay,
    quickHire: form.quick_hire,
    featured: options.featured ?? form.feature_it,
    companyPackageId: options.companyPackageId,
    status: options.status ?? "published",
    screeningQuestions: options.screeningQuestions?.map((q, idx) => ({
      prompt: q.prompt.trim(),
      type: q.type,
      options: q.options.filter(Boolean).length ? q.options.filter(Boolean) : undefined,
      required: q.required,
      sortOrder: idx,
    })),
  };
}
