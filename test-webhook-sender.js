#!/usr/bin/env node

const { dummyWebhookSender } = require('./dist/testing/dummyWebhookSender');

async function main() {
  console.log('🎯 Dummy Webhook Sender Test Tool');
  console.log('==================================');

  const args = process.argv.slice(2);
  const command = args[0] || 'start';

  try {
    switch (command) {
      case 'start':
        console.log('Starting continuous webhook sending...');
        dummyWebhookSender.start();
        
        // Keep the process alive
        console.log('Press Ctrl+C to stop...');
        process.stdin.resume();
        break;

      case 'status':
        const status = dummyWebhookSender.getStatus();
        console.log('Current Status:', JSON.stringify(status, null, 2));
        break;

      case 'single':
        const sourceType = args[1] || 'DISCOURSE';
        const tenantId = args[2] || 'tenant_discourse_123';
        console.log(`Sending single ${sourceType} webhook for ${tenantId}...`);
        await dummyWebhookSender.sendSingleWebhook(sourceType, tenantId);
        console.log('✅ Single webhook sent successfully');
        break;

      case 'burst':
        const burstSourceType = args[1] || 'DISCOURSE';
        const burstTenantId = args[2] || 'tenant_discourse_123';
        const burstCount = parseInt(args[3]) || 5;
        console.log(`Sending burst of ${burstCount} ${burstSourceType} webhooks for ${burstTenantId}...`);
        await dummyWebhookSender.sendBurstWebhooks(burstSourceType, burstTenantId, burstCount);
        console.log('✅ Burst webhooks sent successfully');
        break;

      case 'help':
      default:
        console.log(`
Usage: node test-webhook-sender.js [command] [options]

Commands:
  start                                    Start continuous webhook sending (default)
  status                                   Show current status
  single [sourceType] [tenantId]          Send a single webhook
  burst [sourceType] [tenantId] [count]    Send a burst of webhooks
  help                                     Show this help

Examples:
  node test-webhook-sender.js start
  node test-webhook-sender.js single DISCOURSE tenant_discourse_123
  node test-webhook-sender.js burst INTERCOM tenant_intercom_456 10
  node test-webhook-sender.js status

Available Source Types:
  - DISCOURSE (tenant_discourse_123)
  - INTERCOM (tenant_intercom_456) 
  - PLAYSTORE (tenant_playstore_789)

Note: Make sure your webhook service is running on http://localhost:3000
        `);
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 