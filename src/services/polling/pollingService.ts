import crypto from 'crypto';
import { connectDatabase, disconnectDatabase } from '../../common/database';
import { connectProducer, getProducer, disconnectProducer } from '../../common/kafka';
import { rateLimiter } from '../../common/rateLimiter';
import { PollingConfig, IPollingConfig } from '../../models/pollingConfig';
import { pollingBehaviorRegistry, PollingContext } from './behaviors';
import { pollingStateService } from './PollingStateService';

const KAFKA_TOPIC = 'feedback-ingestion';
const POLLING_CHECK_INTERVAL = 30000; // Check for new polls every 30 seconds

interface PollingJob {
  config: IPollingConfig;
  timeoutId?: NodeJS.Timeout;
  isRunning: boolean;
}

export class PollingService {
  private jobs: Map<string, PollingJob> = new Map();
  private isRunning = false;
  private checkInterval?: NodeJS.Timeout;

  async start(): Promise<void> {
    console.log('Starting Polling Service...');
    
    // Connect to dependencies
    await connectDatabase();
    await connectProducer();
    await rateLimiter.connect();
    await pollingStateService.connect();
    
    // Initialize polling behavior registry
    await pollingBehaviorRegistry.initialize();
    
    this.isRunning = true;
    
    // Load initial configurations
    await this.loadPollingConfigurations();
    
    // Start periodic check for configuration changes
    this.checkInterval = setInterval(() => {
      this.loadPollingConfigurations().catch(console.error);
    }, POLLING_CHECK_INTERVAL);
    
    console.log('Polling Service started');
  }

  async stop(): Promise<void> {
    console.log('Stopping Polling Service...');
    this.isRunning = false;
    
    // Clear check interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    // Stop all polling jobs
    for (const [key, job] of this.jobs) {
      this.stopPollingJob(key);
    }
    
    // Cleanup polling behavior registry
    await pollingBehaviorRegistry.cleanup();
    
    // Disconnect from dependencies
    await pollingStateService.disconnect();
    await rateLimiter.disconnect();
    await disconnectProducer();
    await disconnectDatabase();
    
    console.log('Polling Service stopped');
  }

  /**
   * Load polling configurations from database and start/update jobs
   */
  private async loadPollingConfigurations(): Promise<void> {
    try {
      const configs = await PollingConfig.find({ 'polling_config.enabled': true });
      
      for (const config of configs) {
        const jobKey = this.getJobKey(config);
        const existingJob = this.jobs.get(jobKey);
        
        // Check if polling should be disabled due to failures
        const shouldDisable = await pollingStateService.shouldDisablePolling(
          config.tenant_id,
          config.source_type,
          config.instance_url,
          config.polling_config.max_failures_before_disable
        );
        
        // Skip if disabled due to failures
        if (shouldDisable) {
          if (existingJob) {
            this.stopPollingJob(jobKey);
          }
          continue;
        }
        
        // If configuration changed, restart the job
        if (existingJob && this.hasConfigChanged(existingJob.config, config)) {
          this.stopPollingJob(jobKey);
        }
        
        // Start job if it doesn't exist or was stopped
        if (!this.jobs.has(jobKey)) {
          this.startPollingJob(config);
        }
      }
      
      // Stop jobs for disabled configurations
      for (const [jobKey, job] of this.jobs) {
        const isStillEnabled = configs.some(config => 
          this.getJobKey(config) === jobKey && config.polling_config.enabled
        );
        
        if (!isStillEnabled) {
          this.stopPollingJob(jobKey);
        }
      }
      
    } catch (error) {
      console.error('Error loading polling configurations:', error);
    }
  }

  /**
   * Start a polling job for a configuration
   */
  private startPollingJob(config: IPollingConfig): void {
    const jobKey = this.getJobKey(config);
    
    console.log(`Starting polling job for ${jobKey}`);
    
    const job: PollingJob = {
      config,
      isRunning: false
    };
    
    this.jobs.set(jobKey, job);
    this.scheduleNextPoll(jobKey);
  }

  /**
   * Stop a polling job
   */
  private stopPollingJob(jobKey: string): void {
    const job = this.jobs.get(jobKey);
    if (job) {
      console.log(`Stopping polling job for ${jobKey}`);
      
      if (job.timeoutId) {
        clearTimeout(job.timeoutId);
      }
      
      this.jobs.delete(jobKey);
    }
  }

  /**
   * Schedule the next poll for a job
   */
  private scheduleNextPoll(jobKey: string): void {
    const job = this.jobs.get(jobKey);
    if (!job || !this.isRunning) return;
    
    const intervalMs = job.config.polling_config.interval_seconds * 1000;
    
    job.timeoutId = setTimeout(async () => {
      if (this.isRunning) {
        await this.executePoll(jobKey);
        this.scheduleNextPoll(jobKey); // Schedule next poll
      }
    }, intervalMs);
  }

  /**
   * Execute a single poll for a job
   */
  private async executePoll(jobKey: string): Promise<void> {
    const job = this.jobs.get(jobKey);
    if (!job || job.isRunning) return;
    
    job.isRunning = true;
    const config = job.config;
    const correlationId = crypto.randomUUID();
    
    console.log(`[${correlationId}] Starting poll for ${jobKey}`);
    
    try {
      // Check rate limits
      const rateLimitKey = `${config.tenant_id}:${config.source_type}:api_calls`;
      const minuteAllowed = await rateLimiter.isAllowed(rateLimitKey + ':minute', 60, config.rate_limiting.requests_per_minute);
      const hourAllowed = await rateLimiter.isAllowed(rateLimitKey + ':hour', 3600, config.rate_limiting.requests_per_hour);
      
      if (!minuteAllowed || !hourAllowed) {
        console.log(`[${correlationId}] Rate limit exceeded for ${jobKey}`);
        return;
      }
      
      // Update last attempt timestamp in Redis
      await pollingStateService.updateLastPollAttempt(
        config.tenant_id,
        config.source_type,
        config.instance_url
      );
      
      // Execute the poll using appropriate behavior
      await this.pollWithBehavior(config, correlationId);
      
      // Update success timestamp and reset failure count in Redis
      await pollingStateService.updateSuccessfulPoll(
        config.tenant_id,
        config.source_type,
        config.instance_url
      );
      
      console.log(`[${correlationId}] Poll completed successfully for ${jobKey}`);
      
    } catch (error) {
      console.error(`[${correlationId}] Poll failed for ${jobKey}:`, error);
      
      // Update failure count and potentially disable in Redis
      const errorMessage = error instanceof Error ? error.message : String(error);
      const shouldDisable = await pollingStateService.updateFailedPoll(
        config.tenant_id,
        config.source_type,
        config.instance_url,
        errorMessage,
        config.polling_config.max_failures_before_disable
      );
      
      if (shouldDisable) {
        console.error(`[${correlationId}] Polling disabled for ${jobKey} after ${config.polling_config.max_failures_before_disable} consecutive failures`);
        // Stop the job locally as well
        this.stopPollingJob(jobKey);
      }
      
    } finally {
      job.isRunning = false;
    }
  }

  /**
   * Execute polling using the appropriate behavior for the source type
   */
  private async pollWithBehavior(config: IPollingConfig, correlationId: string): Promise<void> {
    // Get the appropriate polling behavior for this source type
    const behavior = pollingBehaviorRegistry.getBehavior(config.source_type);
    
    // Create polling context
    const context: PollingContext = {
      config,
      correlationId
    };
    
    try {
      // Execute polling using the behavior
      const result = await behavior.poll(context);
      
      console.log(`[${correlationId}] Polling completed using ${behavior.getDisplayName()}: ${result.totalRecords} records, ${result.pagesProcessed} pages`);
      
      // Send each record to Kafka
      for (const record of result.records) {
        await this.publishToKafka(config, record, correlationId);
      }
      
    } catch (error) {
      console.error(`[${correlationId}] Error during polling with ${behavior.getDisplayName()}:`, error);
      throw error;
    }
  }

  /**
   * Publish a record to Kafka
   */
  private async publishToKafka(config: IPollingConfig, record: any, correlationId: string): Promise<void> {
    const message = {
      tenant_id: config.tenant_id,
      source_type: config.source_type,
      source_config: {
        instance_url: config.instance_url,
        api_key: config.api_config.auth?.api_key_value // Only include if needed
      },
      ingestion_method: 'POLLING' as const,
      raw_data: record,
      retry_count: 0,
      correlation_id: correlationId
    };
    
    const producer = getProducer();
    await producer.send({
      topic: KAFKA_TOPIC,
      messages: [{ value: JSON.stringify(message) }],
    });
  }

  /**
   * Generate a unique job key for a configuration
   */
  private getJobKey(config: IPollingConfig): string {
    return `${config.tenant_id}:${config.source_type}:${config.instance_url}`;
  }

  /**
   * Check if configuration has changed
   */
  private hasConfigChanged(oldConfig: IPollingConfig, newConfig: IPollingConfig): boolean {
    // Simple comparison of key fields
    return (
      oldConfig.polling_config.interval_seconds !== newConfig.polling_config.interval_seconds ||
      oldConfig.api_config.endpoint !== newConfig.api_config.endpoint ||
      JSON.stringify(oldConfig.api_config.query_params) !== JSON.stringify(newConfig.api_config.query_params) ||
      JSON.stringify(oldConfig.data_extraction) !== JSON.stringify(newConfig.data_extraction)
    );
  }
}

// Create and export service instance
const pollingService = new PollingService();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received');
  await pollingService.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received');
  await pollingService.stop();
  process.exit(0);
});

// Start the service
pollingService.start().catch((error) => {
  console.error('Failed to start polling service:', error);
  process.exit(1);
});

export default pollingService; 