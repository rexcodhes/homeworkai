import { z } from "zod";

export const resultSchema = z.object({
  document_id: z.string(),
  questions: z.array(
    z.object({
      qid: z.string(),
      question_text: z.string(),
      parts: z.array(
        z.object({
          label: z.string(),
          answer: z.string(),
          workings: z.string(),
        })
      ),
    })
  ),
});
