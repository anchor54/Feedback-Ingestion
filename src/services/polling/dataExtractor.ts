import * as jsonpath from 'jsonpath';
import { AxiosResponse } from 'axios';
import { IPollingConfig } from '../../models/pollingConfig';

export class DataExtractor {
  /**
   * Extract data from API response using configured path
   */
  extractData(response: AxiosResponse, config: IPollingConfig): any[] {
    const { data_extraction } = config;
    let extractedData = response.data;

    // If response_path is configured, use JSONPath to extract specific data
    if (data_extraction.response_path) {
      try {
        const results = jsonpath.query(response.data, data_extraction.response_path);
        extractedData = results.length === 1 ? results[0] : results;
      } catch (error) {
        console.error('JSONPath extraction error:', error);
        console.error('Path:', data_extraction.response_path);
        console.error('Response data:', JSON.stringify(response.data, null, 2));
        throw new Error(`Failed to extract data using path: ${data_extraction.response_path}`);
      }
    }

    // Ensure we return an array
    if (!Array.isArray(extractedData)) {
      extractedData = [extractedData];
    }

    return extractedData;
  }

  /**
   * Check if there's a next page based on pagination configuration
   */
  hasNextPage(response: AxiosResponse, config: IPollingConfig): boolean {
    const { pagination } = config.data_extraction;
    if (!pagination) return false;

    try {
      switch (pagination.type) {
        case 'cursor':
          if (pagination.next_page_path) {
            const nextCursor = jsonpath.query(response.data, pagination.next_page_path);
            return nextCursor.length > 0 && nextCursor[0] !== null && nextCursor[0] !== undefined;
          }
          break;

        case 'page':
          // For page-based pagination, we might need to check if there are more results
          // This is a simple heuristic - if we got a full page, there might be more
          const extractedData = this.extractData(response, config);
          return extractedData.length > 0;

        case 'offset':
          // Similar to page-based, check if we got results
          const offsetData = this.extractData(response, config);
          return offsetData.length > 0;
      }
    } catch (error) {
      console.error('Error checking for next page:', error);
    }

    return false;
  }

  /**
   * Get pagination parameters for the next request
   */
  getNextPageParams(response: AxiosResponse, config: IPollingConfig, currentParams: Record<string, any> = {}): Record<string, any> {
    const { pagination } = config.data_extraction;
    if (!pagination) return {};

    const nextParams: Record<string, any> = {};

    try {
      switch (pagination.type) {
        case 'cursor':
          if (pagination.cursor_param && pagination.next_page_path) {
            const nextCursor = jsonpath.query(response.data, pagination.next_page_path);
            if (nextCursor.length > 0) {
              nextParams[pagination.cursor_param] = nextCursor[0];
            }
          }
          break;

        case 'page':
          if (pagination.page_param) {
            const currentPage = parseInt(currentParams[pagination.page_param] || '1');
            nextParams[pagination.page_param] = currentPage + 1;
          }
          if (pagination.per_page_param && !currentParams[pagination.per_page_param]) {
            nextParams[pagination.per_page_param] = 50; // Default page size
          }
          break;

        case 'offset':
          if (pagination.offset_param && pagination.limit_param) {
            const currentOffset = parseInt(currentParams[pagination.offset_param] || '0');
            const limit = parseInt(currentParams[pagination.limit_param] || '50');
            nextParams[pagination.offset_param] = currentOffset + limit;
            nextParams[pagination.limit_param] = limit;
          }
          break;
      }
    } catch (error) {
      console.error('Error getting next page parameters:', error);
    }

    return nextParams;
  }

  /**
   * Get initial pagination parameters
   */
  getInitialPaginationParams(config: IPollingConfig): Record<string, any> {
    const { pagination } = config.data_extraction;
    if (!pagination) return {};

    const params: Record<string, any> = {};

    switch (pagination.type) {
      case 'page':
        if (pagination.page_param) {
          params[pagination.page_param] = 1;
        }
        if (pagination.per_page_param) {
          params[pagination.per_page_param] = 50; // Default page size
        }
        break;

      case 'offset':
        if (pagination.offset_param) {
          params[pagination.offset_param] = 0;
        }
        if (pagination.limit_param) {
          params[pagination.limit_param] = 50; // Default limit
        }
        break;

      // For cursor-based pagination, we start without any cursor
      case 'cursor':
        if (pagination.per_page_param || pagination.limit_param) {
          const limitParam = pagination.per_page_param || pagination.limit_param;
          params[limitParam!] = 50; // Default limit
        }
        break;
    }

    return params;
  }

  /**
   * Add incremental polling parameters (since timestamp)
   */
  addIncrementalParams(params: Record<string, any>, lastPollTimestamp: Date | null, config: IPollingConfig): Record<string, any> {
    if (!lastPollTimestamp) return params;

    // This is source-specific and would need to be configured per API
    // Common patterns include:
    // - since=timestamp
    // - updated_after=timestamp  
    // - modified_since=timestamp
    
    // For now, we'll use a generic 'since' parameter if not overridden
    if (!params.since && !params.updated_after && !params.modified_since) {
      params.since = lastPollTimestamp.toISOString();
    }

    return params;
  }
} 