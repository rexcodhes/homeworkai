import { Queue } from "bullmq";
import { Jobs } from "../types/job.types";
import { redisClient } from "../config/redis.config";

export const analyzeJobsQueue = new Queue<Jobs>("analyzeJobs", {
  connection: redisClient,
});

export async function enqueueAnalysisJob(jobName: string, jobData: Jobs) {
  try {
    const job = await analyzeJobsQueue.add(jobName, jobData);
    console.log("Enqueued job with id: ", job.id, "and data: ", jobData);
  } catch (e) {
    throw new Error("Failed to enqueue job");
  }
}
