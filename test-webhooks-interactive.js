#!/usr/bin/env node

const { webhookTester } = require('./dist/testing/webhookTester');

async function main() {
  try {
    await webhookTester.start();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the main function
main(); 