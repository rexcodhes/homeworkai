import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { Response } from "express";
import { runLLM } from "../service/analyze.service";
import { prisma } from "../db/prisma.db";
import { makeLLMInputFromText } from "../utils/format.utils";

export async function runAnalysis(req: AuthenticatedRequest, res: Response) {
  const uploadId = req.params.uploadId as string;
  if (!uploadId) {
    return res
      .status(400)
      .json({ message: "uploadId is required", payload: "" });
  }
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized", payload: "" });
  }

  try {
    const upload = await prisma.upload.findUnique({
      where: {
        uploadId: uploadId,
      },
      include: {
        parseResult: true,
      },
    });
    if (!upload) {
      return res.status(404).json({ message: "Upload not found", payload: "" });
    }

    if (upload.userId !== req.user?.userId) {
      return res.status(403).json({ message: "Forbidden", payload: "" });
    }

    const parsed = upload.parseResult?.text as string;
    if (!parsed) {
      return res
        .status(404)
        .json({ message: "parse result not found", payload: "" });
    }

    const newAnalysis = await prisma.analysisResult.create({
      data: {
        uploadId: upload.uploadId,
        output: null as any,
        status: "queued",
      },
    });

    const pdfData = makeLLMInputFromText(parsed);
    console.log("LLM Prompt:", pdfData);
    const result = await runLLM(pdfData);
    console.log("LLM Result:", result);
    const updatedAnalysis = await prisma.analysisResult.update({
      where: {
        id: newAnalysis.id,
      },
      data: {
        output: result,
        status: "completed",
        solutionBucket: upload.bucket,
        solutionKey: upload.key,
      },
    });

    if (!updatedAnalysis) {
      return res
        .status(500)
        .json({ message: "Failed to update analysis", payload: "" });
    }
    return res.status(201).json(updatedAnalysis);
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : "Unknown error",
      payload: "",
    });
  }
}

export async function getAnalysis(req: AuthenticatedRequest, res: Response) {
  const uploadID = req.params.uploadId;
  if (!uploadID) {
    return res
      .status(400)
      .json({ message: "uploadId is required", payload: "" });
  }
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized", payload: "" });
  }

  const analysisId = req.params.analysisId;
  if (!analysisId) {
    return res
      .status(400)
      .json({ message: "analysisId is required", payload: "" });
  }

  try {
    const analysis = await prisma.analysisResult.findFirst({
      where: {
        uploadId: uploadID,
        id: analysisId,
      },
    });
    if (!analysis) {
      return res
        .status(404)
        .json({ message: "Analysis not found", payload: "" });
    }
    return res.status(200).json(analysis.output);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to get analysis", payload: error });
  }
}
