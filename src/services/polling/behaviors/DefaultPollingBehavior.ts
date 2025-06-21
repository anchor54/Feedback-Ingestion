import { PollingBehavior, PollingContext, PollingResult } from './PollingBehavior';
import { ApiClient } from '../apiClient';
import { DataExtractor } from '../dataExtractor';
import { PollingStateService } from '../PollingStateService';

export class DefaultPollingBehavior extends PollingBehavior {
  private apiClient: ApiClient;
  private dataExtractor: DataExtractor;
  private pollingStateService: PollingStateService;

  constructor() {
    super();
    this.apiClient = new ApiClient();
    this.dataExtractor = new DataExtractor();
    this.pollingStateService = new PollingStateService();
  }

  canHandle(sourceType: string): boolean {
    // This is the fallback behavior for any source type not explicitly handled
    return true;
  }

  getDisplayName(): string {
    return 'Default Generic Polling';
  }

  async poll(context: PollingContext): Promise<PollingResult> {
    const { config, correlationId } = context;
    let hasMorePages = true;
    let pageCount = 0;
    let totalRecords = 0;
    const allRecords: any[] = [];
    let paginationParams = this.dataExtractor.getInitialPaginationParams(config);
    
    // Add incremental polling parameters  
    const pollingState = await this.pollingStateService.getPollingState(
      config.tenant_id,
      config.source_type, 
      config.instance_url
    );
    paginationParams = this.dataExtractor.addIncrementalParams(
      paginationParams,
      pollingState.lastSuccessfulPoll || null,
      config
    );
    
    console.log(`[${correlationId}] Starting default polling for ${config.source_type}`);
    
    while (hasMorePages && pageCount < 10) { // Limit to 10 pages per poll
      pageCount++;
      
      console.log(`[${correlationId}] Fetching page ${pageCount} for ${config.source_type}`);
      
      try {
        const response = await this.apiClient.makeRequest(config, paginationParams);
        const extractedData = this.dataExtractor.extractData(response, config);
        
        if (extractedData.length > 0) {
          allRecords.push(...extractedData);
          totalRecords += extractedData.length;
        }
        
        // Check for next page
        hasMorePages = this.dataExtractor.hasNextPage(response, config);
        if (hasMorePages) {
          paginationParams = {
            ...paginationParams,
            ...this.dataExtractor.getNextPageParams(response, config, paginationParams)
          };
        }
        
        // Small delay between pages to be respectful
        if (hasMorePages) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`[${correlationId}] Error fetching page ${pageCount}:`, error);
        throw error;
      }
    }
    
    console.log(`[${correlationId}] Default polling completed: ${pageCount} pages, ${totalRecords} records`);
    
    return {
      records: allRecords,
      totalRecords,
      pagesProcessed: pageCount,
      hasMoreData: hasMorePages
    };
  }
} 