import { Request } from 'express';
import { SourceType } from '../../../common/types';

export interface WebhookContext {
  tenantId: string;
  sourceType: SourceType;
  request: Request;
  correlationId: string;
}

export interface WebhookResult {
  sourceConfig: {
    instance_url?: string;
    api_key?: string;
    [key: string]: any;
  };
  rawData: any;
  isValid: boolean;
  errorMessage?: string;
}

export abstract class WebhookHandler {
  /**
   * Check if this handler can process the given source type
   */
  abstract canHandle(sourceType: SourceType): boolean;

  /**
   * Extract source-specific configuration from the request
   */
  abstract extractSourceConfig(context: WebhookContext): Promise<WebhookResult['sourceConfig']>;

  /**
   * Validate the webhook payload (e.g., signature verification)
   */
  abstract validatePayload(context: WebhookContext): Promise<boolean>;

  /**
   * Process the webhook and extract relevant data
   */
  async processWebhook(context: WebhookContext): Promise<WebhookResult> {
    try {
      // Validate the payload first
      const isValid = await this.validatePayload(context);
      if (!isValid) {
        return {
          sourceConfig: {},
          rawData: {},
          isValid: false,
          errorMessage: 'Invalid webhook signature or payload'
        };
      }

      // Extract source-specific configuration
      const sourceConfig = await this.extractSourceConfig(context);

      return {
        sourceConfig,
        rawData: context.request.body,
        isValid: true
      };

    } catch (error) {
      return {
        sourceConfig: {},
        rawData: {},
        isValid: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get the display name for this handler
   */
  abstract getDisplayName(): string;
} 