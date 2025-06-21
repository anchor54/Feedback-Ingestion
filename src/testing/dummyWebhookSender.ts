import axios from 'axios';
import crypto from 'crypto';
import { SourceType } from '../common/types';

interface WebhookTestConfig {
  webhookUrl: string;
  tenantId: string;
  sourceType: SourceType;
  interval: number; // seconds
  enabled: boolean;
}

export class DummyWebhookSender {
  private configs: WebhookTestConfig[] = [];
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;

  constructor() {
    this.setupTestConfigurations();
  }

  private setupTestConfigurations(): void {
    this.configs = [
      {
        webhookUrl: 'http://localhost:3000/webhooks/DISCOURSE/tenant_discourse_123',
        tenantId: 'tenant_discourse_123',
        sourceType: SourceType.DISCOURSE,
        interval: 30, // Send every 30 seconds
        enabled: true
      },
      {
        webhookUrl: 'http://localhost:3000/webhooks/INTERCOM/tenant_intercom_456',
        tenantId: 'tenant_intercom_456', 
        sourceType: SourceType.INTERCOM,
        interval: 45, // Send every 45 seconds
        enabled: true
      },
      {
        webhookUrl: 'http://localhost:3000/webhooks/PLAYSTORE/tenant_playstore_789',
        tenantId: 'tenant_playstore_789',
        sourceType: SourceType.PLAYSTORE, 
        interval: 60, // Send every 60 seconds
        enabled: true
      }
    ];
  }

  start(): void {
    console.log('🚀 Starting Dummy Webhook Sender...');
    this.isRunning = true;

    for (const config of this.configs) {
      if (config.enabled) {
        this.startSendingWebhooks(config);
      }
    }

    console.log(`✅ Started ${this.configs.filter(c => c.enabled).length} webhook senders`);
  }

  stop(): void {
    console.log('🛑 Stopping Dummy Webhook Sender...');
    this.isRunning = false;

    for (const [key, interval] of this.intervals) {
      clearInterval(interval);
      this.intervals.delete(key);
    }

    console.log('✅ All webhook senders stopped');
  }

  private startSendingWebhooks(config: WebhookTestConfig): void {
    const key = `${config.tenantId}-${config.sourceType}`;
    
    console.log(`📡 Starting webhook sender for ${config.sourceType} (${config.tenantId}) - interval: ${config.interval}s`);

    const interval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.sendWebhook(config);
      } catch (error) {
        console.error(`❌ Failed to send ${config.sourceType} webhook:`, error);
      }
    }, config.interval * 1000);

    this.intervals.set(key, interval);
  }

  private async sendWebhook(config: WebhookTestConfig): Promise<void> {
    const payload = this.generatePayload(config.sourceType);
    const headers = this.generateHeaders(config.sourceType, payload);

    console.log(`📤 Sending ${config.sourceType} webhook to ${config.webhookUrl}`);

    try {
      const response = await axios.post(config.webhookUrl, payload, {
        headers,
        timeout: 10000
      });

      console.log(`✅ ${config.sourceType} webhook sent successfully - Status: ${response.status}, Correlation ID: ${response.data?.correlation_id}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`❌ ${config.sourceType} webhook failed - Status: ${error.response?.status}, Message: ${error.message}`);
      } else {
        console.error(`❌ ${config.sourceType} webhook failed:`, error);
      }
      throw error;
    }
  }

  private generatePayload(sourceType: SourceType): any {
    const now = new Date();
    const randomId = Math.floor(Math.random() * 1000000);

    switch (sourceType) {
      case SourceType.DISCOURSE:
        return this.generateDiscoursePayload(randomId, now);
      case SourceType.INTERCOM:
        return this.generateIntercomPayload(randomId, now);
      case SourceType.PLAYSTORE:
        return this.generatePlaystorePayload(randomId, now);
      default:
        throw new Error(`Unknown source type: ${sourceType}`);
    }
  }

  private generateDiscoursePayload(id: number, timestamp: Date): any {
    const topics = [
      'Bug Report: Login Issues',
      'Feature Request: Dark Mode',
      'Help: Installation Problems',
      'Feedback: New UI Design',
      'Question: API Documentation'
    ];

    const usernames = ['john_doe', 'jane_smith', 'developer_mike', 'user_sarah', 'admin_alex'];
    const contents = [
      'I\'m experiencing login issues with the new update. The page keeps refreshing.',
      'Could we please add a dark mode option? It would be great for night usage.',
      'Having trouble installing the latest version. Getting error code 500.',
      'The new UI looks amazing! Really loving the clean design.',
      'Where can I find the API documentation for the latest version?'
    ];

    return {
      id: id,
      name: 'Test User',
      username: usernames[Math.floor(Math.random() * usernames.length)],
      avatar_template: '/user_avatar/discourse.example.com/user/{size}/123_2.png',
      created_at: timestamp.toISOString(),
      updated_at: timestamp.toISOString(),
      cooked: `<p>${contents[Math.floor(Math.random() * contents.length)]}</p>`,
      post_number: Math.floor(Math.random() * 50) + 1,
      post_type: 1,
      reply_count: Math.floor(Math.random() * 5),
      quote_count: 0,
      incoming_link_count: 0,
      reads: Math.floor(Math.random() * 100) + 1,
      readers_count: Math.floor(Math.random() * 50) + 1,
      score: Math.random() * 100,
      yours: false,
      topic_id: Math.floor(Math.random() * 1000) + 1,
      topic_slug: 'test-topic-' + id,
      topic_title_headline: topics[Math.floor(Math.random() * topics.length)],
      like_count: Math.floor(Math.random() * 10),
      instance_url: 'https://discourse.example.com'
    };
  }

  private generateIntercomPayload(id: number, timestamp: Date): any {
    const subjects = [
      'Account Setup Help',
      'Billing Question',
      'Technical Support',
      'Feature Request',
      'General Inquiry'
    ];

    const messages = [
      'Hi, I need help setting up my account. Can someone assist me?',
      'I have a question about my billing. The charges seem incorrect.',
      'I\'m having technical issues with the mobile app. It keeps crashing.',
      'Would love to see integration with Slack in the future!',
      'Just wanted to say thanks for the great support!'
    ];

    return {
      id: `msg_${id}`,
      message_id: `msg_${id}`,
      conversation_id: `conv_${Math.floor(id / 10)}`,
      subject: subjects[Math.floor(Math.random() * subjects.length)],
      body: messages[Math.floor(Math.random() * messages.length)],
      message: messages[Math.floor(Math.random() * messages.length)],
      created_at: timestamp.toISOString(),
      updated_at: timestamp.toISOString(),
      message_type: 'customer',
      priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
      author: {
        id: `user_${Math.floor(Math.random() * 1000)}`,
        name: 'Test Customer',
        username: 'test_customer',
        email: 'customer@example.com'
      },
      user: {
        id: `user_${Math.floor(Math.random() * 1000)}`,
        name: 'Test Customer', 
        username: 'test_customer'
      }
    };
  }

  private generatePlaystorePayload(id: number, timestamp: Date): any {
    const appNames = [
      'Amazing Todo App',
      'Photo Editor Pro',
      'Music Player Plus',
      'Fitness Tracker',
      'Recipe Manager'
    ];

    const reviews = [
      'Great app! Really helpful for organizing my tasks.',
      'Love the new features in the latest update.',
      'App crashes frequently. Please fix.',
      'Best photo editor I\'ve used. Highly recommended!',
      'Good app but could use more customization options.'
    ];

    const packageNames = [
      'com.example.todoapp',
      'com.example.photoeditor',
      'com.example.musicplayer',
      'com.example.fitness',
      'com.example.recipes'
    ];

    return {
      reviewId: `review_${id}`,
      id: `review_${id}`,
      packageName: packageNames[Math.floor(Math.random() * packageNames.length)],
      authorName: 'App User',
      authorId: `user_${Math.floor(Math.random() * 10000)}`,
      text: reviews[Math.floor(Math.random() * reviews.length)],
      comment: reviews[Math.floor(Math.random() * reviews.length)],
      title: appNames[Math.floor(Math.random() * appNames.length)] + ' Review',
      starRating: Math.floor(Math.random() * 5) + 1,
      rating: Math.floor(Math.random() * 5) + 1,
      submittedMillis: timestamp.getTime(),
      created_at: timestamp.toISOString(),
      lastModified: timestamp.toISOString(),
      language: 'en',
      appVersionName: `${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
      device: ['Samsung Galaxy S21', 'iPhone 13', 'Pixel 6', 'OnePlus 9'][Math.floor(Math.random() * 4)],
      androidOsVersion: `${Math.floor(Math.random() * 3) + 11}.0`
    };
  }

  private generateHeaders(sourceType: SourceType, payload: any): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': `Dummy-${sourceType}-Webhook/1.0`
    };

    // Add source-specific headers
    switch (sourceType) {
      case SourceType.DISCOURSE:
        headers['X-Discourse-Instance'] = 'https://discourse.example.com';
        headers['X-Discourse-Event'] = 'post_created';
        headers['X-Discourse-Event-Id'] = String(payload.id);
        headers['X-Discourse-Event-Signature'] = this.generateSignature(payload, 'discourse_secret');
        break;

      case SourceType.INTERCOM:
        headers['X-Intercom-Webhook-Id'] = `webhook_${Date.now()}`;
        headers['X-Intercom-Hmac-SHA256'] = this.generateSignature(payload, 'intercom_secret');
        break;

      case SourceType.PLAYSTORE:
        headers['X-Playstore-Notification-Type'] = 'review';
        headers['X-Playstore-Package-Name'] = payload.packageName;
        break;
    }

    return headers;
  }

  private generateSignature(payload: any, secret: string): string {
    const payloadString = JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
  }

  // Manual trigger methods for testing
  async sendSingleWebhook(sourceType: SourceType, tenantId: string): Promise<void> {
    const config = this.configs.find(c => c.sourceType === sourceType && c.tenantId === tenantId);
    if (!config) {
      throw new Error(`No configuration found for ${sourceType} and tenant ${tenantId}`);
    }
    await this.sendWebhook(config);
  }

  async sendBurstWebhooks(sourceType: SourceType, tenantId: string, count: number = 5): Promise<void> {
    console.log(`🔥 Sending ${count} ${sourceType} webhooks for ${tenantId}...`);
    
    for (let i = 0; i < count; i++) {
      try {
        await this.sendSingleWebhook(sourceType, tenantId);
        console.log(`✅ Sent webhook ${i + 1}/${count}`);
        
        // Small delay between bursts to avoid overwhelming
        if (i < count - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`❌ Failed to send webhook ${i + 1}/${count}:`, error);
      }
    }
  }

  getStatus(): any {
    return {
      isRunning: this.isRunning,
      activeConfigs: this.configs.filter(c => c.enabled).length,
      totalConfigs: this.configs.length,
      configs: this.configs.map(c => ({
        tenantId: c.tenantId,
        sourceType: c.sourceType,
        interval: c.interval,
        enabled: c.enabled,
        url: c.webhookUrl
      }))
    };
  }
}

// Create and export instance
export const dummyWebhookSender = new DummyWebhookSender();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  dummyWebhookSender.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  dummyWebhookSender.stop();
  process.exit(0);
}); 