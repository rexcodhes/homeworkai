import { z } from "zod";

export const presignSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.literal("application/pdf"),
  size: z
    .number()
    .int()
    .positive()
    .max(50 * 1024 * 1024)
    .optional(),
  folder: z.string().optional(),
});

export const confirmSchema = z.object({
  bucket: z.string(),
  key: z.string().min(1),
});
