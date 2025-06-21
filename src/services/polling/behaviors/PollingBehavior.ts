import { IPollingConfig } from '../../../models/pollingConfig';

export interface PollingContext {
  config: IPollingConfig;
  correlationId: string;
}

export interface PollingResult {
  records: any[];
  totalRecords: number;
  pagesProcessed: number;
  hasMoreData?: boolean;
}

export abstract class PollingBehavior {
  /**
   * Execute polling for a specific source type
   * @param context - The polling context containing config and correlation ID
   * @returns Promise<PollingResult> - The result of the polling operation
   */
  abstract poll(context: PollingContext): Promise<PollingResult>;

  /**
   * Validate if this behavior can handle the given source type
   * @param sourceType - The source type to validate
   * @returns boolean - True if this behavior can handle the source type
   */
  abstract canHandle(sourceType: string): boolean;

  /**
   * Get the display name for this polling behavior
   */
  abstract getDisplayName(): string;

  /**
   * Optional method to perform setup/initialization for the behavior
   */
  async initialize?(): Promise<void>;

  /**
   * Optional method to perform cleanup for the behavior
   */
  async cleanup?(): Promise<void>;
} 