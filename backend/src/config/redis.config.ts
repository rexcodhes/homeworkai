import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

export const redisConfig: string = process.env.REDIS_URL as string;
export const redisClient = new Redis(redisConfig, {
  maxRetriesPerRequest: null,
});
