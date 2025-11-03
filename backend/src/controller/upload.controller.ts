import { Response } from "express";
import { presignSchema, confirmSchema } from "../schema/upload.schema";
import { presignPut, headObject } from "../services/storage.service";
import crypto from "crypto";
import { prisma } from "../db/prisma.db";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}
function sanitizeFolder(input?: string) {
  if (!input) return "";
  const clean = input.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  return clean ? `${clean}/` : "";
}

export async function presignUpload(req: AuthenticatedRequest, res: Response) {
  const parsed = presignSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { filename, contentType, folder } = parsed.data;
  const key = `${sanitizeFolder(folder)}${sanitizeFilename(filename)}`;

  try {
    const { url, bucket, expiresAt } = await presignPut({
      key,
      contentType,
    });

    const newUpload = await prisma.upload.create({
      data: {
        userId: req.user?.userId as number,
        key,
        bucket,
        status: "uploading",
      },
    });

    if (!newUpload) {
      return res.status(500).json({ error: "Failed to create presigned URL" });
    }

    res.status(200).json({
      uploadId: newUpload.uploadId,
      url,
      key,
      bucket,
      expiresAt,
    });
  } catch (e) {
    return res.status(500).json({ error: "Failed to create presigned URL" });
  }
}

export async function confirmUpload(req: AuthenticatedRequest, res: Response) {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const upload = await prisma.upload.findFirst({
      where: {
        bucket: parsed.data.bucket as string,
        key: parsed.data.key,
      },
    });

    if (upload?.userId !== user.userId) {
      return res.status(403).json({ error: "User mismatch" });
    }
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

    if (!updatedUpload) {
      return res.status(500).json({ error: "Failed to confirm upload" });
    }

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

export async function listUpload(req: AuthenticatedRequest, res: Response) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const listUploads = await prisma.upload.findMany({
      where: { userId: user.userId },
      include: { parseResult: true, analyses: true },
    });

    if (!listUploads) {
      return res.status(500).json({ error: "Uploads doesn't exist" });
    }

    return res.status(200).json({ listUploads });
  } catch (error) {
    return res.status(500).json({ error: "Failed to list uploads" });
  }
}

export async function getUpload(req: AuthenticatedRequest, res: Response) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { uploadId } = req.params;
  if (!uploadId) {
    return res.status(400).json({ error: "Missing uploadId" });
  }
  try {
    const upload = await prisma.upload.findFirst({
      where: { uploadId: uploadId, userId: user.userId },
      include: { parseResult: true, analyses: true },
    });

    if (!upload) {
      return res.status(404).json({ error: "Upload not found" });
    }

    if (upload.userId !== user.userId) {
      return res.status(403).json({ error: "User mismatch" });
    }

    return res.status(200).json({ upload });
  } catch (error) {
    return res.status(500).json({ error: "Failed to get upload" });
  }
}

export async function deleteUpload(req: AuthenticatedRequest, res: Response) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { uploadId } = req.params;
  if (!uploadId) {
    return res.status(400).json({ error: "Missing uploadId" });
  }
  try {
    const upload = await prisma.upload.findFirst({
      where: { uploadId: uploadId, userId: user.userId },
    });
    if (!upload) {
      return res.status(404).json({ error: "Upload not found" });
    }

    if (upload.userId !== user.userId) {
      return res.status(403).json({ error: "User mismatch" });
    }

    await prisma.upload.delete({
      where: { uploadId: uploadId },
    });
    return res.status(200).json({ message: "Upload deleted successfully" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete upload" });
  }
}
