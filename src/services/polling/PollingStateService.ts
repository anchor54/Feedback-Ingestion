import { createClient } from 'redis';
import { SourceType } from '../../common/types';

interface PollingState {
  lastSuccessfulPoll?: Date;
  lastPollAttempt?: Date;
  consecutiveFailures: number;
  lastError?: string;
  lastErrorTimestamp?: Date;
}

export class PollingStateService {
  private redis: ReturnType<typeof createClient>;

  constructor() {
    this.redis = createClient({
      url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`
    });
  }

  /**
   * Generate a unique key for polling state
   */
  private getStateKey(tenantId: string, sourceType: SourceType, instanceUrl: string): string {
    // Use a consistent format: polling_state:{tenant}:{source}:{instance_hash}
    const instanceHash = Buffer.from(instanceUrl).toString('base64').slice(0, 8);
    return `polling_state:${tenantId}:${sourceType}:${instanceHash}`;
  }

  /**
   * Get polling state for a specific source
   */
  async getPollingState(tenantId: string, sourceType: SourceType, instanceUrl: string): Promise<PollingState> {
    const key = this.getStateKey(tenantId, sourceType, instanceUrl);
    
    try {
      const data = await this.redis.hGetAll(key);
      
      if (!data || Object.keys(data).length === 0) {
        // Return default state if no data exists
        return {
          consecutiveFailures: 0
        };
      }

      return {
        lastSuccessfulPoll: data.lastSuccessfulPoll ? new Date(data.lastSuccessfulPoll) : undefined,
        lastPollAttempt: data.lastPollAttempt ? new Date(data.lastPollAttempt) : undefined,
        consecutiveFailures: parseInt(data.consecutiveFailures || '0'),
        lastError: data.lastError || undefined,
        lastErrorTimestamp: data.lastErrorTimestamp ? new Date(data.lastErrorTimestamp) : undefined
      };
    } catch (error) {
      console.error(`Error getting polling state for ${key}:`, error);
      // Return default state on error
      return {
        consecutiveFailures: 0
      };
    }
  }

  /**
   * Update last poll attempt timestamp
   */
  async updateLastPollAttempt(tenantId: string, sourceType: SourceType, instanceUrl: string): Promise<void> {
    const key = this.getStateKey(tenantId, sourceType, instanceUrl);
    const timestamp = new Date().toISOString();
    
    try {
      await this.redis.hSet(key, 'lastPollAttempt', timestamp);
      // Set expiration to 30 days for cleanup
      await this.redis.expire(key, 30 * 24 * 60 * 60);
    } catch (error) {
      console.error(`Error updating last poll attempt for ${key}:`, error);
    }
  }

  /**
   * Update polling state after successful poll
   */
  async updateSuccessfulPoll(tenantId: string, sourceType: SourceType, instanceUrl: string): Promise<void> {
    const key = this.getStateKey(tenantId, sourceType, instanceUrl);
    const timestamp = new Date().toISOString();
    
    try {
      await this.redis.hSet(key, {
        lastSuccessfulPoll: timestamp,
        consecutiveFailures: '0'
      });
      // Clear any previous error
      await this.redis.hDel(key, ['lastError', 'lastErrorTimestamp']);
      // Set expiration to 30 days for cleanup
      await this.redis.expire(key, 30 * 24 * 60 * 60);
    } catch (error) {
      console.error(`Error updating successful poll for ${key}:`, error);
    }
  }

  /**
   * Update polling state after failed poll
   */
  async updateFailedPoll(
    tenantId: string, 
    sourceType: SourceType, 
    instanceUrl: string, 
    error: string,
    maxFailures: number = 5
  ): Promise<boolean> {
    const key = this.getStateKey(tenantId, sourceType, instanceUrl);
    const timestamp = new Date().toISOString();
    
    try {
      // Get current state
      const currentState = await this.getPollingState(tenantId, sourceType, instanceUrl);
      const newFailureCount = currentState.consecutiveFailures + 1;
      const shouldDisable = newFailureCount >= maxFailures;

      await this.redis.hSet(key, {
        consecutiveFailures: newFailureCount.toString(),
        lastError: error,
        lastErrorTimestamp: timestamp
      });
      
      // Set expiration to 30 days for cleanup
      await this.redis.expire(key, 30 * 24 * 60 * 60);
      
      return shouldDisable;
    } catch (redisError) {
      console.error(`Error updating failed poll for ${key}:`, redisError);
      return false;
    }
  }

  /**
   * Reset failure count for a source (used to re-enable polling)
   */
  async resetFailureCount(tenantId: string, sourceType: SourceType, instanceUrl: string): Promise<void> {
    const key = this.getStateKey(tenantId, sourceType, instanceUrl);
    
    try {
      await this.redis.hSet(key, 'consecutiveFailures', '0');
      // Remove error fields
      await this.redis.hDel(key, ['lastError', 'lastErrorTimestamp']);
      // Set expiration to 30 days for cleanup
      await this.redis.expire(key, 30 * 24 * 60 * 60);
    } catch (error) {
      console.error(`Error resetting failure count for ${key}:`, error);
    }
  }

  /**
   * Check if polling should be disabled based on failure count
   */
  async shouldDisablePolling(tenantId: string, sourceType: SourceType, instanceUrl: string, maxFailures: number): Promise<boolean> {
    try {
      const state = await this.getPollingState(tenantId, sourceType, instanceUrl);
      return state.consecutiveFailures >= maxFailures;
    } catch (error) {
      console.error(`Error checking if polling should be disabled:`, error);
      return false;
    }
  }

  /**
   * Get all polling states for a tenant (for monitoring/debugging)
   */
  async getTenantPollingStates(tenantId: string): Promise<Array<{ key: string; state: PollingState }>> {
    try {
      const pattern = `polling_state:${tenantId}:*`;
      const keys = await this.redis.keys(pattern);
      
      const results = [];
      for (const key of keys) {
        const data = await this.redis.hGetAll(key);
        const state: PollingState = {
          lastSuccessfulPoll: data.lastSuccessfulPoll ? new Date(data.lastSuccessfulPoll) : undefined,
          lastPollAttempt: data.lastPollAttempt ? new Date(data.lastPollAttempt) : undefined,
          consecutiveFailures: parseInt(data.consecutiveFailures || '0'),
          lastError: data.lastError || undefined,
          lastErrorTimestamp: data.lastErrorTimestamp ? new Date(data.lastErrorTimestamp) : undefined
        };
        results.push({ key, state });
      }
      
      return results;
    } catch (error) {
      console.error(`Error getting tenant polling states for ${tenantId}:`, error);
      return [];
    }
  }

  /**
   * Clean up old polling states (can be called periodically)
   */
  async cleanupOldStates(olderThanDays: number = 30): Promise<number> {
    try {
      const pattern = 'polling_state:*';
      const keys = await this.redis.keys(pattern);
      let deletedCount = 0;
      
      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -1) {
          // Key has no expiration, set one
          await this.redis.expire(key, olderThanDays * 24 * 60 * 60);
        }
      }
      
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up old polling states:', error);
      return 0;
    }
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    try {
      await this.redis.connect();
      console.log('Connected to Redis for polling state');
    } catch (error) {
      console.error('Failed to connect to Redis for polling state:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
    console.log('Disconnected from Redis for polling state');
  }
}

// Export a singleton instance
export const pollingStateService = new PollingStateService(); 