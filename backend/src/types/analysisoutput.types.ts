import { resultSchema } from "../schema/result.schema";
import { z } from "zod";

export type AnalysisOutput = z.infer<typeof resultSchema>;
