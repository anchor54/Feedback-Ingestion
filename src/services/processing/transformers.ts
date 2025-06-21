import crypto from 'crypto';
import { IFeedback } from '../../models/feedback';
import { SourceType } from '../../common/types';

export interface QueueMessage {
  tenant_id: string;
  source_type: SourceType;
  source_config?: {
    instance_url?: string;
    api_key?: string;
  };
  ingestion_method: 'POLLING' | 'WEBHOOK';
  raw_data: any;
  retry_count: number;
  correlation_id: string;
}

export const transformDiscourseData = (message: QueueMessage): Partial<IFeedback> => {
  const { tenant_id, raw_data, source_config } = message;
  
  const instance_url = source_config?.instance_url || 'unknown';
  const source_id = String(raw_data.id);
  
  // Generate dedup hash based on key fields including instance_url for Discourse
  const dedupString = `${tenant_id}-DISCOURSE-${source_id}-${instance_url}`;
  const dedup_hash = crypto.createHash('sha256').update(dedupString).digest('hex');

  // Extract content - prefer 'cooked' (HTML) over 'raw' if available, fallback to blurb
  let body = '';
  if (raw_data.cooked) {
    // Remove HTML tags for plain text content
    body = raw_data.cooked.replace(/<[^>]*>/g, '').trim();
  } else if (raw_data.raw) {
    body = raw_data.raw;
  } else if (raw_data.blurb) {
    body = raw_data.blurb;
  }

  const transformed: Partial<IFeedback> = {
    tenant_id,
    source_info: {
      type: SourceType.DISCOURSE,
      source_id,
      instance_url
    },
    feedback_type: 'POST',
    content: {
      title: raw_data.topic_title_headline || raw_data.topic_title || '',
      body: body,
      author: {
        name: raw_data.name || '',
        username: raw_data.username || '',
        id: String(raw_data.user_id || '')
      }
    },
    timestamps: {
      created_at: new Date(raw_data.created_at || Date.now()),
      updated_at: raw_data.updated_at ? new Date(raw_data.updated_at) : undefined,
      ingested_at: new Date()
    },
    language: 'en', // Default, could be enhanced with language detection
    metadata: {
      topic_id: raw_data.topic_id,
      topic_slug: raw_data.topic_slug,
      post_number: raw_data.post_number,
      post_type: raw_data.post_type,
      like_count: raw_data.like_count || 0,
      reads: raw_data.reads || 0,
      reply_count: raw_data.reply_count || 0,
      quote_count: raw_data.quote_count || 0,
      score: raw_data.score || 0,
      avatar_template: raw_data.avatar_template
    },
    dedup_hash
  };

  return transformed;
};

export const transformFeedbackData = (message: QueueMessage): Partial<IFeedback> => {
  switch (message.source_type) {
    case SourceType.DISCOURSE:
      return transformDiscourseData(message);
    default:
      throw new Error(`Unknown source type: ${message.source_type}`);
  }
}; 