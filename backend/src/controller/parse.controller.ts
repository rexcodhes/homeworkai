import { Request, Response } from "express";
import { parsePDF } from "../service/parse.service";
import { prisma } from "../db/prisma";

export async function parsePDFController(req: Request, res: Response) {
  const uploadId = req.params.uploadId;
  if (!uploadId) {
    return res.status(400).json({ error: "Missing uploadId" });
  }

  try {
    const upload = await prisma.upload.findUnique({
      where: {
        uploadId: uploadId,
      },
    });
    if (!upload) {
      return res.status(404).json({ error: "Upload not found" });
    }
  } catch (e) {
    return res.status(500).json({ error: "Failed to parse PDF" });
  }
}
