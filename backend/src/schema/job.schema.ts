import { z } from "zod";

export const jobSchema = z.object({
  analysisId: z.string(),
  uploadId: z.string(),
});
