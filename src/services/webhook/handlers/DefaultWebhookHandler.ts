import { WebhookHandler, WebhookContext, WebhookResult } from './WebhookHandler';
import { SourceType } from '../../../common/types';

export class DefaultWebhookHandler extends WebhookHandler {
  canHandle(sourceType: SourceType): boolean {
    // This is the fallback handler for any source type not explicitly handled
    return true;
  }

  getDisplayName(): string {
    return 'Default Generic Webhook Handler';
  }

  async extractSourceConfig(context: WebhookContext): Promise<WebhookResult['sourceConfig']> {
    const { request } = context;
    
    // Generic logic: try to extract common configuration fields
    const sourceConfig: any = {};

    // Try to extract instance URL from various common places
    if (request.headers['x-instance-url']) {
      sourceConfig.instance_url = request.headers['x-instance-url'];
    } else if (request.body.instance_url) {
      sourceConfig.instance_url = request.body.instance_url;
    } else if (request.body.site_url) {
      sourceConfig.instance_url = request.body.site_url;
    } else if (request.body.url) {
      sourceConfig.instance_url = request.body.url;
    } else {
      sourceConfig.instance_url = 'unknown';
    }

    // Try to extract API key if present
    if (request.headers['x-api-key']) {
      sourceConfig.api_key = request.headers['x-api-key'];
    } else if (request.body.api_key) {
      sourceConfig.api_key = request.body.api_key;
    }

    // Add any other headers that might be useful
    const relevantHeaders = [
      'user-agent',
      'x-forwarded-for',
      'x-real-ip',
      'authorization'
    ];

    for (const header of relevantHeaders) {
      if (request.headers[header]) {
        sourceConfig[header.replace(/-/g, '_')] = request.headers[header];
      }
    }

    return sourceConfig;
  }

  async validatePayload(context: WebhookContext): Promise<boolean> {
    const { request } = context;

    // Basic validation for any webhook
    if (!request.body) {
      console.error(`[${context.correlationId}] Missing webhook payload`);
      return false;
    }

    // Ensure payload is an object (not a string or other primitive)
    if (typeof request.body !== 'object') {
      console.error(`[${context.correlationId}] Webhook payload must be a JSON object`);
      return false;
    }

    // Check for empty payload
    if (Object.keys(request.body).length === 0) {
      console.warn(`[${context.correlationId}] Webhook payload is empty`);
      // Don't fail validation for empty payload, just warn
    }

    console.log(`[${context.correlationId}] Generic webhook validation passed for ${context.sourceType}`);
    return true;
  }
} 