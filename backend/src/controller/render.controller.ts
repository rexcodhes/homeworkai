import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { prisma } from "../db/prisma.db";
import { renderSlimToPdfBuffer } from "../services/render.service";
import { resultSchema } from "../schema/result.schema";
import { s3 } from "../config/storage.config";
import { PutObjectCommand } from "@aws-sdk/client-s3";

export async function renderAnalysis(req: AuthenticatedRequest, res: Response) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized", payload: "" });
  }

  const uploadId = req.params.uploadId;
  if (!uploadId) {
    return res
      .status(400)
      .json({ message: "uploadId is required", payload: "" });
  }

  const analysisId = req.params.analysisId;
  if (!analysisId) {
    return res
      .status(400)
      .json({ message: "analysisId is required", payload: "" });
  }

  try {
    const upload = await prisma.upload.findUnique({
      where: {
        uploadId: uploadId,
      },
    });

    if (!upload) {
      return res.status(404).json({ message: "Upload not found", payload: "" });
    }

    if (upload.userId !== user.userId) {
      return res.status(403).json({ message: "Forbidden", payload: "" });
    }

    const analysis = await prisma.analysisResult.findFirst({
      where: {
        uploadId: uploadId,
        id: analysisId,
      },
    });

    if (!analysis) {
      return res
        .status(404)
        .json({ message: "Analysis not found", payload: "" });
    }

    const output = resultSchema.safeParse(analysis.output);
    if (!output.success) {
      return res
        .status(400)
        .json({ message: "Invalid output", payload: output.error });
    }

    const { buffer, pages } = await renderSlimToPdfBuffer(output.data);

    const key = `${uploadId}/${analysisId}.pdf`;
    const command = await s3.send(
      new PutObjectCommand({
        Bucket: upload.bucket,
        Key: key,
        Body: buffer,
        ContentType: "application/pdf",
      })
    );

    return res.status(200).json({ key, pages });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to render analysis", payload: error });
  }
}
