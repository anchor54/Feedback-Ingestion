// Core interfaces and base classes
export { WebhookHandler, WebhookContext, WebhookResult } from './WebhookHandler';

// Default handler
export { DefaultWebhookHandler } from './DefaultWebhookHandler';

// Source-specific handlers
export { DiscourseWebhookHandler } from './DiscourseWebhookHandler';

// Registry
export { WebhookHandlerRegistry, webhookHandlerRegistry } from './WebhookHandlerRegistry'; 