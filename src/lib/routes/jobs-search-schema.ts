import { z } from "zod";

/** Search params for `/jobs/$slug` — only `apply`; not the full `/jobs` filter schema. */
export const jobDetailSearchSchema = z
  .object({
    apply: z
      .unknown()
      .optional()
      .transform((v) => (v === 1 || v === "1" || v === true ? (1 as const) : undefined)),
  })
  .catch({});

export type JobDetailSearch = z.infer<typeof jobDetailSearchSchema>;
