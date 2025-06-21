import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redis.on('error', (err) => console.error('Redis Client Error', err));

export class RateLimiter {
  private redisClient: typeof redis;

  constructor() {
    this.redisClient = redis;
  }

  async connect(): Promise<void> {
    if (!this.redisClient.isOpen) {
      await this.redisClient.connect();
      console.log('Redis rate limiter connected');
    }
  }

  async disconnect(): Promise<void> {
    if (this.redisClient.isOpen) {
      await this.redisClient.disconnect();
      console.log('Redis rate limiter disconnected');
    }
  }

  /**
   * Check if a request is allowed based on rate limits
   * @param key - Unique identifier for the rate limit (e.g., "tenant_123:DISCOURSE:api_calls")
   * @param windowSizeSeconds - Time window in seconds
   * @param maxRequests - Maximum requests allowed in the window
   * @returns Promise<boolean> - true if request is allowed, false otherwise
   */
  async isAllowed(key: string, windowSizeSeconds: number, maxRequests: number): Promise<boolean> {
    try {
      const now = Date.now();
      const windowStart = now - (windowSizeSeconds * 1000);
      
      // Use Redis sorted set to track requests with timestamps
      const pipeline = this.redisClient.multi();
      
      // Remove old requests outside the window
      pipeline.zRemRangeByScore(key, 0, windowStart);
      
      // Count current requests in the window
      pipeline.zCard(key);
      
      const results = await pipeline.exec();
      const currentCount = (results?.[1] as unknown as number) || 0;
      
      if (currentCount >= maxRequests) {
        return false;
      }
      
      // Add current request to the set
      await this.redisClient.zAdd(key, { score: now, value: now.toString() });
      
      // Set expiration for the key (cleanup)
      await this.redisClient.expire(key, windowSizeSeconds * 2);
      
      return true;
    } catch (error) {
      console.error('Rate limiter error:', error);
      // In case of Redis failure, allow the request (fail open)
      return true;
    }
  }

  /**
   * Get the current request count for a rate limit key
   */
  async getCurrentCount(key: string, windowSizeSeconds: number): Promise<number> {
    try {
      const now = Date.now();
      const windowStart = now - (windowSizeSeconds * 1000);
      
      // Remove old requests and count current ones
      await this.redisClient.zRemRangeByScore(key, 0, windowStart);
      return await this.redisClient.zCard(key);
    } catch (error) {
      console.error('Rate limiter count error:', error);
      return 0;
    }
  }

  /**
   * Get time until rate limit resets (in seconds)
   */
  async getTimeUntilReset(key: string, windowSizeSeconds: number): Promise<number> {
    try {
      const oldest = await this.redisClient.zRange(key, 0, 0, { BY: 'SCORE', REV: false });
      if (oldest.length === 0) {
        return 0;
      }
      
      const oldestTimestamp = parseInt(oldest[0]);
      const resetTime = oldestTimestamp + (windowSizeSeconds * 1000);
      const now = Date.now();
      
      return Math.max(0, Math.ceil((resetTime - now) / 1000));
    } catch (error) {
      console.error('Rate limiter reset time error:', error);
      return 0;
    }
  }
}

export const rateLimiter = new RateLimiter(); 