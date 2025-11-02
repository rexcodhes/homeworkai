import { prisma } from "../db/prisma.db";
import { makeLLMInputFromText } from "../utils/format.utils";
import { runLLM } from "../service/analyze.service";
import { jobSchema } from "../schema/job.schema";
import { Prisma, AnalysisStatus } from "@prisma/client";
import { resultSchema } from "../schema/result.schema";
import { Jobs } from "../types/job.types";
import { Job } from "bullmq";

export async function processAnalyzeJob(job: Job<Jobs>) {
  const parsed = jobSchema.safeParse(job.data);
  if (!parsed.success) {
    throw new Error("Invalid job schema");
  }
  const analysisId: string = parsed.data.analysisId;
  try {
    const data = await prisma.analysisResult.findUnique({
      where: {
        id: parsed.data.analysisId,
      },
      include: { upload: { include: { parseResult: true } } },
    });
    if (!data) {
      throw new Error("Analysis result not found");
    }
    if (data.upload?.parseResult?.text === undefined) {
      await prisma.analysisResult.update({
        where: {
          id: data.id,
        },
        data: {
          status: AnalysisStatus.failed,
          error: "Parsed result not found",
        },
      });
      throw new Error("Parse result not found");
    }

    await prisma.analysisResult.update({
      where: {
        id: data.id,
      },
      data: { status: AnalysisStatus.running },
    });
    const parsedResult: string = data.upload.parseResult?.text;
    const input = makeLLMInputFromText(parsedResult);

    if (!input) {
      await prisma.analysisResult.update({
        where: {
          id: data.id,
        },
        data: {
          status: AnalysisStatus.failed,
          error: "Failed to make llm input",
        },
      });
      throw new Error("Invalid input");
    }
    const output = await runLLM(input);
    const parsedOutput = resultSchema.safeParse(output);
    if (!parsedOutput.success) {
      await prisma.analysisResult.update({
        where: {
          id: data.id,
        },
        data: {
          status: AnalysisStatus.failed,
          error: "Invalid output",
        },
      });
      throw new Error("Invalid output");
    }

    const validated = parsedOutput.data as unknown as Prisma.InputJsonValue;

    await prisma.analysisResult.update({
      where: {
        id: data.id,
      },
      data: {
        status: AnalysisStatus.completed,
        output: validated,
      },
    });
  } catch (error) {
    throw new Error("Error processing job");
  }
}
