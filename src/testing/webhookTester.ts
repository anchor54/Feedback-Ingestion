import readline from 'readline';
import { dummyWebhookSender } from './dummyWebhookSender';
import { SourceType } from '../common/types';

interface TestingSession {
  rl: readline.Interface;
  isRunning: boolean;
}

export class WebhookTester {
  private session: TestingSession;

  constructor() {
    this.session = {
      rl: readline.createInterface({
        input: process.stdin,
        output: process.stdout
      }),
      isRunning: false
    };
  }

  async start(): Promise<void> {
    console.log('🎯 Interactive Webhook Testing Tool');
    console.log('===================================');
    console.log('This tool helps you test your webhook service by sending dummy data.');
    console.log('');

    await this.showMainMenu();
  }

  private async showMainMenu(): Promise<void> {
    while (true) {
      console.log('\n📋 Main Menu:');
      console.log('1. Send single webhook');
      console.log('2. Send burst of webhooks');
      console.log('3. Start continuous sending');
      console.log('4. Stop continuous sending');
      console.log('5. Check sender status');
      console.log('6. Test all source types');
      console.log('7. Help');
      console.log('8. Exit');

      const choice = await this.prompt('\nEnter your choice (1-8): ');

      try {
        switch (choice.trim()) {
          case '1':
            await this.sendSingleWebhook();
            break;
          case '2':
            await this.sendBurstWebhooks();
            break;
          case '3':
            await this.startContinuousSending();
            break;
          case '4':
            await this.stopContinuousSending();
            break;
          case '5':
            await this.checkStatus();
            break;
          case '6':
            await this.testAllSourceTypes();
            break;
          case '7':
            this.showHelp();
            break;
          case '8':
            await this.exit();
            return;
          default:
            console.log('❌ Invalid choice. Please enter a number between 1-8.');
        }
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : String(error));
      }
    }
  }

  private async sendSingleWebhook(): Promise<void> {
    console.log('\n📤 Send Single Webhook');
    console.log('Available source types:');
    console.log('1. DISCOURSE (tenant_discourse_123)');
    console.log('2. INTERCOM (tenant_intercom_456)');
    console.log('3. PLAYSTORE (tenant_playstore_789)');

    const choice = await this.prompt('Select source type (1-3): ');
    
    let sourceType: SourceType;
    let tenantId: string;

    switch (choice.trim()) {
      case '1':
        sourceType = SourceType.DISCOURSE;
        tenantId = 'tenant_discourse_123';
        break;
      case '2':
        sourceType = SourceType.INTERCOM;
        tenantId = 'tenant_intercom_456';
        break;
      case '3':
        sourceType = SourceType.PLAYSTORE;
        tenantId = 'tenant_playstore_789';
        break;
      default:
        console.log('❌ Invalid choice. Using DISCOURSE as default.');
        sourceType = SourceType.DISCOURSE;
        tenantId = 'tenant_discourse_123';
    }

    console.log(`\n🚀 Sending ${sourceType} webhook for ${tenantId}...`);
    
    try {
      await dummyWebhookSender.sendSingleWebhook(sourceType, tenantId);
      console.log('✅ Webhook sent successfully!');
    } catch (error) {
      console.error('❌ Failed to send webhook:', error instanceof Error ? error.message : String(error));
    }
  }

  private async sendBurstWebhooks(): Promise<void> {
    console.log('\n🔥 Send Burst of Webhooks');
    console.log('Available source types:');
    console.log('1. DISCOURSE (tenant_discourse_123)');
    console.log('2. INTERCOM (tenant_intercom_456)');
    console.log('3. PLAYSTORE (tenant_playstore_789)');

    const choice = await this.prompt('Select source type (1-3): ');
    const countStr = await this.prompt('How many webhooks to send? (default: 5): ');
    
    let sourceType: SourceType;
    let tenantId: string;
    const count = parseInt(countStr.trim()) || 5;

    switch (choice.trim()) {
      case '1':
        sourceType = SourceType.DISCOURSE;
        tenantId = 'tenant_discourse_123';
        break;
      case '2':
        sourceType = SourceType.INTERCOM;
        tenantId = 'tenant_intercom_456';
        break;
      case '3':
        sourceType = SourceType.PLAYSTORE;
        tenantId = 'tenant_playstore_789';
        break;
      default:
        console.log('❌ Invalid choice. Using DISCOURSE as default.');
        sourceType = SourceType.DISCOURSE;
        tenantId = 'tenant_discourse_123';
    }

    console.log(`\n🚀 Sending ${count} ${sourceType} webhooks for ${tenantId}...`);
    
    try {
      await dummyWebhookSender.sendBurstWebhooks(sourceType, tenantId, count);
      console.log(`✅ Successfully sent ${count} webhooks!`);
    } catch (error) {
      console.error('❌ Failed to send burst webhooks:', error instanceof Error ? error.message : String(error));
    }
  }

  private async startContinuousSending(): Promise<void> {
    if (this.session.isRunning) {
      console.log('⚠️ Continuous sending is already running!');
      return;
    }

    console.log('\n🔄 Starting Continuous Webhook Sending');
    console.log('This will send webhooks at regular intervals:');
    console.log('- DISCOURSE: every 30 seconds');
    console.log('- INTERCOM: every 45 seconds');
    console.log('- PLAYSTORE: every 60 seconds');

    const confirm = await this.prompt('Start continuous sending? (y/n): ');
    
    if (confirm.toLowerCase().trim() === 'y' || confirm.toLowerCase().trim() === 'yes') {
      dummyWebhookSender.start();
      this.session.isRunning = true;
      console.log('✅ Continuous sending started! Use option 4 to stop.');
    } else {
      console.log('❌ Continuous sending cancelled.');
    }
  }

  private async stopContinuousSending(): Promise<void> {
    if (!this.session.isRunning) {
      console.log('⚠️ Continuous sending is not running!');
      return;
    }

    console.log('\n🛑 Stopping Continuous Webhook Sending');
    dummyWebhookSender.stop();
    this.session.isRunning = false;
    console.log('✅ Continuous sending stopped.');
  }

  private async checkStatus(): Promise<void> {
    console.log('\n📊 Webhook Sender Status');
    const status = dummyWebhookSender.getStatus();
    
    console.log('Status:', status.isRunning ? '🟢 Running' : '🔴 Stopped');
    console.log('Active Configs:', status.activeConfigs);
    console.log('Total Configs:', status.totalConfigs);
    console.log('\nConfigurations:');
    
    status.configs.forEach((config: any, index: number) => {
      console.log(`  ${index + 1}. ${config.sourceType} (${config.tenantId})`);
      console.log(`     Interval: ${config.interval}s | Enabled: ${config.enabled ? '✅' : '❌'}`);
      console.log(`     URL: ${config.url}`);
    });
  }

  private async testAllSourceTypes(): Promise<void> {
    console.log('\n🧪 Testing All Source Types');
    console.log('This will send one webhook for each source type...');

    const confirm = await this.prompt('Proceed? (y/n): ');
    
    if (confirm.toLowerCase().trim() !== 'y' && confirm.toLowerCase().trim() !== 'yes') {
      console.log('❌ Test cancelled.');
      return;
    }

    const sourceTypes = [
      { type: SourceType.DISCOURSE, tenant: 'tenant_discourse_123' },
      { type: SourceType.INTERCOM, tenant: 'tenant_intercom_456' },
      { type: SourceType.PLAYSTORE, tenant: 'tenant_playstore_789' }
    ];

    for (const source of sourceTypes) {
      try {
        console.log(`\n🚀 Testing ${source.type}...`);
        await dummyWebhookSender.sendSingleWebhook(source.type, source.tenant);
        console.log(`✅ ${source.type} webhook sent successfully`);
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`❌ ${source.type} webhook failed:`, error instanceof Error ? error.message : String(error));
      }
    }

    console.log('\n🎉 All source type tests completed!');
  }

  private showHelp(): void {
    console.log('\n📖 Help & Information');
    console.log('======================');
    console.log('');
    console.log('This tool simulates external services sending webhooks to your webhook service.');
    console.log('');
    console.log('🎯 Purpose:');
    console.log('- Test your webhook receiver service');
    console.log('- Verify end-to-end pipeline (webhook → kafka → processing → database)');
    console.log('- Load test with burst or continuous sending');
    console.log('');
    console.log('📡 Source Types:');
    console.log('- DISCOURSE: Simulates forum posts from Discourse');
    console.log('- INTERCOM: Simulates customer messages from Intercom');
    console.log('- PLAYSTORE: Simulates app reviews from Google Play Store');
    console.log('');
    console.log('🔧 Prerequisites:');
    console.log('- Webhook service running on http://localhost:3000');
    console.log('- Kafka running and accessible');
    console.log('- Processing service running to consume from Kafka');
    console.log('- MongoDB running for data storage');
    console.log('');
    console.log('💡 Tips:');
    console.log('- Use single webhooks for basic testing');
    console.log('- Use burst for load testing');
    console.log('- Use continuous for long-running tests');
    console.log('- Check your logs to verify data flow');
  }

  public async exit(): Promise<void> {
    console.log('\n👋 Goodbye!');
    
    if (this.session.isRunning) {
      console.log('🛑 Stopping continuous sending...');
      dummyWebhookSender.stop();
    }
    
    this.session.rl.close();
    process.exit(0);
  }

  private prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.session.rl.question(question, resolve);
    });
  }
}

// Create and export instance
export const webhookTester = new WebhookTester();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\nSIGTERM signal received');
  await webhookTester.exit();
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT signal received');
  await webhookTester.exit();
});