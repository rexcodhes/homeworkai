import { PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, storageBucket } from "../config/storage.config";

export async function presignPut(params: {
  key: string;
  contentType: string;
  bucket?: string;
  expiresIn?: number;
}) {
  const bucket = params.bucket ?? storageBucket;
  const expiresIn = params.expiresIn ?? 600;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: params.key,
    ContentType: params.contentType,
  });
  const url = await getSignedUrl(s3, command, { expiresIn });
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  return { bucket, key: params.key, url, expiresAt };
}

export async function headObject(params: { key: string; bucket?: string }) {
  const bucket = params.bucket ?? storageBucket;
  const res = await s3.send(
    new HeadObjectCommand({ Bucket: bucket, Key: params.key })
  );
  return {
    bucket,
    key: params.key,
    contentLength: res.ContentLength ?? 0,
    contentType: res.ContentType ?? "",
    etag: (res.ETag || "").replaceAll('"', ""),
    lastModified: res.LastModified?.toISOString(),
  };
}
