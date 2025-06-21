/**
 * Supported source types for feedback ingestion
 */
export enum SourceType {
  DISCOURSE = 'DISCOURSE',
  INTERCOM = 'INTERCOM',
  PLAYSTORE = 'PLAYSTORE',
  TWITTER = 'TWITTER',
  JSONPLACEHOLDER = 'JSONPLACEHOLDER', // For testing purposes
}

/**
 * Type alias for backward compatibility and flexibility
 */
export type SourceTypeString = `${SourceType}`; 