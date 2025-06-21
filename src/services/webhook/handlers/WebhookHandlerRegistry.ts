import { WebhookHandler } from './WebhookHandler';
import { DiscourseWebhookHandler } from './DiscourseWebhookHandler';
import { DefaultWebhookHandler } from './DefaultWebhookHandler';
import { SourceType } from '../../../common/types';

export class WebhookHandlerRegistry {
  private handlers: WebhookHandler[] = [];
  private defaultHandler: WebhookHandler;

  constructor() {
    this.defaultHandler = new DefaultWebhookHandler();
    this.registerDefaultHandlers();
  }

  /**
   * Register the default set of webhook handlers
   */
  private registerDefaultHandlers(): void {
    this.register(new DiscourseWebhookHandler());
    // Add more source-specific handlers here as they are implemented
  }

  /**
   * Register a new webhook handler
   * @param handler - The webhook handler to register
   */
  register(handler: WebhookHandler): void {
    this.handlers.push(handler);
    console.log(`Registered webhook handler: ${handler.getDisplayName()}`);
  }

  /**
   * Get the appropriate webhook handler for a source type
   * @param sourceType - The source type to get handler for
   * @returns WebhookHandler - The appropriate handler or default if none found
   */
  getHandler(sourceType: SourceType): WebhookHandler {
    // Find the first handler that can handle this source type
    const specificHandler = this.handlers.find(handler => 
      handler.canHandle(sourceType)
    );

    if (specificHandler) {
      console.log(`Using specific handler for ${sourceType}: ${specificHandler.getDisplayName()}`);
      return specificHandler;
    }

    console.log(`No specific handler found for ${sourceType}, using default handler`);
    return this.defaultHandler;
  }

  /**
   * Get all registered handlers
   * @returns WebhookHandler[] - Array of all registered handlers
   */
  getAllHandlers(): WebhookHandler[] {
    return [...this.handlers, this.defaultHandler];
  }

  /**
   * Get information about all registered handlers
   * @returns Array of handler info
   */
  getHandlerInfo(): Array<{ sourceTypes: SourceType[], displayName: string }> {
    const info = this.handlers.map(handler => ({
      sourceTypes: this.getSourceTypesForHandler(handler),
      displayName: handler.getDisplayName()
    }));

    // Add default handler info
    info.push({
      sourceTypes: Object.values(SourceType) as SourceType[],
      displayName: this.defaultHandler.getDisplayName()
    });

    return info;
  }

  /**
   * Get source types that a handler can handle (for informational purposes)
   */
  private getSourceTypesForHandler(handler: WebhookHandler): SourceType[] {
    return Object.values(SourceType).filter(sourceType => 
      handler.canHandle(sourceType)
    );
  }

  /**
   * Validate that a source type is supported
   */
  isSourceTypeSupported(sourceType: string): sourceType is SourceType {
    return Object.values(SourceType).includes(sourceType as SourceType);
  }
}

// Export a singleton instance
export const webhookHandlerRegistry = new WebhookHandlerRegistry();