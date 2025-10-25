import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const endpoint = process.env.STORAGE_ENDPOINT;
const region = process.env.STORAGE_REGION || "us-east-1";
const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
const forcePathStyle =
  String(process.env.STORAGE_FORCE_PATH_STYLE ?? "true").toLowerCase() ===
  "true";

if (!endpoint || !accessKeyId || !secretAccessKey) {
  throw new Error(
    "Missing storage env: STORAGE_ENDPOINT/ACCESS_KEY_ID/SECRET_ACCESS_KEY"
  );
}

export const storageBucket =
  process.env.STORAGE_BUCKET || "homeworkai-dev-uploads";

export const s3 = new S3Client({
  region,
  endpoint,
  forcePathStyle,
  credentials: { accessKeyId, secretAccessKey },
});
