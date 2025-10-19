import { Request, Response } from "express";
import { parsePDF } from "../service/parse.service";
import { prisma } from "../db/prisma";
import { s3 } from "../config/storage";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";

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

    const command = new GetObjectCommand({
      Bucket: upload.bucket,
      Key: upload.key,
    });

    const response = await s3.send(command);
    const body = response.Body;

    if (body instanceof Readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of body) {
        chunks.push(chunk as Buffer);
      }
      const buffer = Buffer.concat(chunks);
      const pdfData = (await parsePDF(buffer)) as any;

      const parsedResult = await prisma.parseResult.upsert({
        where: {
          uploadId: uploadId,
        },
        create: {
          uploadId: uploadId,
          text: pdfData.text,
        },
        update: {
          text: pdfData.text,
        },
      });

      return res.json(pdfData);
    } else {
      return res.status(500).json({ error: "Failed to parse PDF" });
    }
  } catch (e) {
    return res.status(500).json({ error: "Failed to parse PDF" });
  }
}
