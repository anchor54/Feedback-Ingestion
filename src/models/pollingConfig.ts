import mongoose, { Schema, Document } from 'mongoose';
import { SourceType } from '../common/types';

export interface IPollingConfig extends Document {
  tenant_id: string;
  source_type: SourceType;
  instance_url: string;
  api_config: {
    endpoint: string;
    method: 'GET' | 'POST';
    headers?: Record<string, string>;
    query_params?: Record<string, string>;
    body?: Record<string, any>;
    auth?: {
      type: 'bearer' | 'basic' | 'api_key';
      token?: string;
      username?: string;
      password?: string;
      api_key_header?: string;
      api_key_value?: string;
    };
  };
  polling_config: {
    interval_seconds: number;
    enabled: boolean;
    max_failures_before_disable: number;
  };
  data_extraction: {
    response_path?: string; // JSONPath to extract data from response
    pagination?: {
      type: 'offset' | 'cursor' | 'page';
      limit_param?: string;
      offset_param?: string;
      cursor_param?: string;
      page_param?: string;
      per_page_param?: string;
      next_page_path?: string; // JSONPath to next page indicator
    };
  };
  rate_limiting: {
    requests_per_minute: number;
    requests_per_hour: number;
  };
  created_at: Date;
  updated_at: Date;
}

const PollingConfigSchema: Schema = new Schema({
  tenant_id: { type: String, required: true },
  source_type: { type: String, required: true },
  instance_url: { type: String, required: true },
  api_config: {
    endpoint: { type: String, required: true },
    method: { type: String, enum: ['GET', 'POST'], default: 'GET' },
    headers: { type: Schema.Types.Mixed },
    query_params: { type: Schema.Types.Mixed },
    body: { type: Schema.Types.Mixed },
    auth: {
      type: { type: String, enum: ['bearer', 'basic', 'api_key'] },
      token: { type: String },
      username: { type: String },
      password: { type: String },
      api_key_header: { type: String },
      api_key_value: { type: String }
    }
  },
  polling_config: {
    interval_seconds: { type: Number, required: true, min: 60 }, // Minimum 1 minute
    enabled: { type: Boolean, default: true },
    max_failures_before_disable: { type: Number, default: 5 }
  },
  data_extraction: {
    response_path: { type: String },
    pagination: {
      type: { type: String, enum: ['offset', 'cursor', 'page'] },
      limit_param: { type: String },
      offset_param: { type: String },
      cursor_param: { type: String },
      page_param: { type: String },
      per_page_param: { type: String },
      next_page_path: { type: String }
    }
  },
  rate_limiting: {
    requests_per_minute: { type: Number, default: 60 },
    requests_per_hour: { type: Number, default: 1000 }
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Create compound unique index
PollingConfigSchema.index(
  { 
    tenant_id: 1,
    source_type: 1,
    instance_url: 1 
  },
  { unique: true }
);

// Additional indexes
PollingConfigSchema.index({ 'polling_config.enabled': 1 });

export const PollingConfig = mongoose.model<IPollingConfig>('PollingConfig', PollingConfigSchema); 