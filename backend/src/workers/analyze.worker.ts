import { Worker } from "bullmq";
import Redis from "ioredis";
import dotenv from "dotenv";
import { processAnalyzeJob } from "../processors/analyze.processor";

dotenv.config();
const env = process.env;

const connection = new Redis(env.REDIS_URL as string, {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  "analysisJobs",
  async (job) => {
    console.log("Processing job:", job.data);
    await processAnalyzeJob(job);
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  if (job) {
    console.log(`Job ${job.id} failed with error: ${err.message}`);
  }
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, closing worker...");
  await worker.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing worker...");
  await worker.close();
  process.exit(0);
});

console.log("Worker started");
