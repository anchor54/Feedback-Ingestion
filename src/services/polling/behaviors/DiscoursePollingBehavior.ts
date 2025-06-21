import { PollingBehavior, PollingContext, PollingResult } from './PollingBehavior';
import { DiscourseClient } from '../discourseClient';
import { SourceType } from '../../../common/types';
import { PollingStateService } from '../PollingStateService';

export class DiscoursePollingBehavior extends PollingBehavior {
  private discourseClient?: DiscourseClient;
  private pollingStateService: PollingStateService;

  constructor() {
    super();
    this.pollingStateService = new PollingStateService();
  }

  canHandle(sourceType: string): boolean {
    return sourceType === SourceType.DISCOURSE;
  }

  getDisplayName(): string {
    return 'Discourse Specialized Polling';
  }

  async poll(context: PollingContext): Promise<PollingResult> {
    const { config, correlationId } = context;
    
    console.log(`[${correlationId}] Starting Discourse-specific polling for ${config.instance_url}`);
    
    // Initialize Discourse client for this specific config
    this.discourseClient = new DiscourseClient(config);
    
    // Determine time range for incremental polling
    const pollingState = await this.pollingStateService.getPollingState(
      config.tenant_id, 
      config.source_type, 
      config.instance_url
    );
    const afterDate = pollingState.lastSuccessfulPoll || 
                     new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to last 24 hours
    
    console.log(`[${correlationId}] Fetching Discourse posts after: ${afterDate.toISOString()}`);
    
    try {
      // Use the specialized Discourse workflow
      const detailedPosts = await this.discourseClient.fetchPostsWithDetails(
        afterDate,
        undefined, // No before date for incremental polling
        5 // Max 5 pages per poll
      );
      
      console.log(`[${correlationId}] Discourse polling completed: found ${detailedPosts.length} detailed posts`);
      
      return {
        records: detailedPosts,
        totalRecords: detailedPosts.length,
        pagesProcessed: 1, // DiscourseClient handles pagination internally
        hasMoreData: false // We fetch all available data in one go
      };
      
    } catch (error) {
      console.error(`[${correlationId}] Error during Discourse polling:`, error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    // Clean up any resources if needed
    this.discourseClient = undefined;
  }
} 