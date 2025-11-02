import { Worker } from "bullmq";
import { processAnalyzeJob } from "../processors/analyze.processor";
import { Jobs } from "../types/job.types";
import { Job } from "bullmq";
import { redisClient } from "../config/redis.config";

const worker = new Worker<Jobs>(
  "analyzeJobs",
  async function worker(job: Job<Jobs>) {
    await processAnalyzeJob(job);
    console.log("Processing job:", job);
  },
  { connection: redisClient }
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
