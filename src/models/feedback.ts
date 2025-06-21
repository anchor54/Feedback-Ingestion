import mongoose, { Schema, Document } from 'mongoose';
import { SourceType } from '../common/types';

export interface IFeedback extends Document {
  tenant_id: string;
  source_info: {
    type: SourceType;
    source_id: string;
    instance_url: string;
  };
  feedback_type: string;
  content: {
    title?: string;
    body: string;
    author: {
      name?: string;
      username?: string;
      id?: string;
    };
  };
  timestamps: {
    created_at: Date;
    updated_at?: Date;
    ingested_at: Date;
  };
  language?: string;
  metadata: Record<string, any>;
  dedup_hash: string;
}

const FeedbackSchema: Schema = new Schema({
  tenant_id: { type: String, required: true },
  source_info: {
    type: { type: String, required: true },
    source_id: { type: String, required: true },
    instance_url: { type: String, required: true }
  },
  feedback_type: { type: String, required: true },
  content: {
    title: { type: String },
    body: { type: String, required: true },
    author: {
      name: { type: String },
      username: { type: String },
      id: { type: String }
    }
  },
  timestamps: {
    created_at: { type: Date, required: true },
    updated_at: { type: Date },
    ingested_at: { type: Date, required: true, default: Date.now }
  },
  language: { type: String, default: 'en' },
  metadata: { type: Schema.Types.Mixed },
  dedup_hash: { type: String, required: true }
});

// Create source-specific unique compound indexes for idempotency

// Discourse: tenant_id + source_type + source_id + instance_url
FeedbackSchema.index(
  { 
    tenant_id: 1,
    'source_info.type': 1,
    'source_info.source_id': 1,
    'source_info.instance_url': 1
  },
  { 
    unique: true,
    partialFilterExpression: { 'source_info.type': SourceType.DISCOURSE }
  }
);

// Additional indexes for common query patterns
FeedbackSchema.index({ 'timestamps.created_at': 1 });
FeedbackSchema.index({ feedback_type: 1 });
FeedbackSchema.index({ language: 1 });
FeedbackSchema.index({ 'source_info.instance_url': 1 });

export const Feedback = mongoose.model<IFeedback>('Feedback', FeedbackSchema); 