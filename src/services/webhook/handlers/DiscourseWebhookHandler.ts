import { WebhookHandler, WebhookContext, WebhookResult } from './WebhookHandler';
import { SourceType } from '../../../common/types';

export class DiscourseWebhookHandler extends WebhookHandler {
  canHandle(sourceType: SourceType): boolean {
    return sourceType === SourceType.DISCOURSE;
  }

  getDisplayName(): string {
    return 'Discourse Webhook Handler';
  }

  async extractSourceConfig(context: WebhookContext): Promise<WebhookResult['sourceConfig']> {
    const { request } = context;
    
    // Discourse-specific logic: extract instance URL from headers or body
    const instanceUrl = 
      request.headers['x-discourse-instance'] as string || 
      request.headers['x-discourse-instance-url'] as string ||
      request.body.instance_url || 
      request.body.site_url ||
      'unknown';

    return {
      instance_url: instanceUrl
    };
  }

  async validatePayload(context: WebhookContext): Promise<boolean> {
    const { request } = context;

    // TODO: Implement Discourse webhook signature verification
    // Discourse typically sends a signature in the X-Discourse-Event-Signature header
    // For now, we'll do basic validation
    
    // Check if required headers are present
    if (!request.headers['x-discourse-event-id'] && !request.headers['x-discourse-event']) {
      console.warn(`[${context.correlationId}] Missing Discourse event headers`);
      // Don't fail validation for now, just warn
    }

    // Basic payload validation
    if (!request.body || typeof request.body !== 'object') {
      console.error(`[${context.correlationId}] Invalid Discourse payload: not an object`);
      return false;
    }

    // Check for basic Discourse webhook structure
    if (!request.body.post && !request.body.topic && !request.body.user) {
      console.warn(`[${context.correlationId}] Discourse payload doesn't contain expected fields (post, topic, or user)`);
      // Don't fail validation, as different Discourse events have different structures
    }

    return true;
  }
} 