import { Request, Response } from "express";
import { presignSchema, confirmSchema } from "../schema/upload.schema";
import { presignPut, headObject } from "../service/storage.service";
import crypto from "crypto";
import { prisma } from "../db/prisma";

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}
function sanitizeFolder(input?: string) {
  if (!input) return "";
  const clean = input.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  return clean ? `${clean}/` : "";
}

export async function presignUpload(req: Request, res: Response) {
  const parsed = presignSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const { filename, contentType, folder } = parsed.data;
  const uploadId = crypto.randomUUID();
  const key = `${sanitizeFolder(folder)}${sanitizeFilename(filename)}`;

  try {
    const { url, bucket, expiresAt } = await presignPut({
      key,
      contentType,
    });

    const newUpload = await prisma.upload.create({
      data: {
        uploadId,
        key,
        bucket,
        status: "uploading",
      },
    });

    res.status(200).json({
      uploadId,
      url,
      key,
      bucket,
      expiresAt,
    });
  } catch (e) {
    return res.status(500).json({ error: "Failed to create presigned URL" });
  }
}

export async function confirmUpload(req: Request, res: Response) {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  try {
    const { bucket, key } = parsed.data;
    const meta = await headObject(bucket ? { key, bucket } : { key });

    const updatedUpload = await prisma.upload.update({
      where: {
        bucket_key: { bucket: meta.bucket, key },
      },
      data: {
        status: "uploaded",
        confirmedAt: new Date(),
        size: meta.contentLength,
        mime: meta.contentType,
        etag: meta.etag,
        checksum: meta.etag,
      },
    });

    return res.status(200).json({
      bucket,
      key,
      contentLength: meta.contentLength,
      contentType: meta.contentType,
      etag: meta.etag,
      lastModified: meta.lastModified,
    });
  } catch (e) {
    return res.status(500).json({ error: "Failed to confirm upload" });
  }
}
