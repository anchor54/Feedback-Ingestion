import { QueueMessage } from './transformers';
import { SourceType } from '../../common/types';

export interface IdempotencyFilter {
  [key: string]: any;
}

export const generateDiscourseFilter = (message: QueueMessage): IdempotencyFilter => {
  const { tenant_id, raw_data, source_config } = message;
  
  // For Discourse, we use tenant_id + source_type + post_id + instance_url
  // This allows the same post ID from different Discourse instances
  return {
    tenant_id,
    'source_info.type': SourceType.DISCOURSE,
    'source_info.source_id': String(raw_data.post?.id || raw_data.id),
    'source_info.instance_url': source_config?.instance_url || 'unknown'
  };
};


export const generateIdempotencyFilter = (message: QueueMessage): IdempotencyFilter => {
  switch (message.source_type) {
    case SourceType.DISCOURSE:
      return generateDiscourseFilter(message);
    default:
      // Fallback to basic filter
      return {
        tenant_id: message.tenant_id,
        'source_info.type': message.source_type,
        'source_info.source_id': String(message.raw_data.id)
      };
  }
}; 