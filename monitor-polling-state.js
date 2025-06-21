const { createClient } = require('redis');

// Create Redis connection
const redis = createClient({
  url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`
});

async function monitorPollingStates() {
  try {
    await redis.connect();
    
    console.log('=== Polling State Monitor ===\n');
    
    // Get all polling state keys
    const keys = await redis.keys('polling_state:*');
    
    if (keys.length === 0) {
      console.log('No polling states found in Redis.');
      return;
    }
    
    console.log(`Found ${keys.length} polling state(s):\n`);
    
    for (const key of keys) {
      const data = await redis.hGetAll(key);
      
      // Parse the key to extract components
      const [, tenant, sourceType, instanceHash] = key.split(':');
      
      console.log(`📊 Key: ${key}`);
      console.log(`   Tenant: ${tenant}`);
      console.log(`   Source Type: ${sourceType}`);
      console.log(`   Instance Hash: ${instanceHash}`);
      console.log(`   Consecutive Failures: ${data.consecutiveFailures || 0}`);
      
      if (data.lastSuccessfulPoll) {
        const lastSuccess = new Date(data.lastSuccessfulPoll);
        console.log(`   Last Successful Poll: ${lastSuccess.toISOString()}`);
      } else {
        console.log(`   Last Successful Poll: Never`);
      }
      
      if (data.lastPollAttempt) {
        const lastAttempt = new Date(data.lastPollAttempt);
        console.log(`   Last Poll Attempt: ${lastAttempt.toISOString()}`);
      } else {
        console.log(`   Last Poll Attempt: Never`);
      }
      
      if (data.lastError) {
        console.log(`   Last Error: ${data.lastError}`);
        if (data.lastErrorTimestamp) {
          const lastErrorTime = new Date(data.lastErrorTimestamp);
          console.log(`   Last Error Time: ${lastErrorTime.toISOString()}`);
        }
      }
      
      // Check TTL
      const ttl = await redis.ttl(key);
      if (ttl > 0) {
        const days = Math.floor(ttl / (24 * 60 * 60));
        const hours = Math.floor((ttl % (24 * 60 * 60)) / (60 * 60));
        console.log(`   TTL: ${days}d ${hours}h`);
      } else if (ttl === -1) {
        console.log(`   TTL: No expiration`);
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('Error monitoring polling states:', error);
  } finally {
    await redis.quit();
  }
}

async function resetPollingState(tenantId, sourceType, instanceUrl) {
  try {
    await redis.connect();
    
    // Generate the same key format as the PollingStateService
    const instanceHash = Buffer.from(instanceUrl).toString('base64').slice(0, 8);
    const key = `polling_state:${tenantId}:${sourceType}:${instanceHash}`;
    
    console.log(`Resetting polling state for: ${key}`);
    
    // Reset failure count
    await redis.hSet(key, 'consecutiveFailures', '0');
    
    // Remove error fields
    await redis.hDel(key, ['lastError', 'lastErrorTimestamp']);
    
    console.log('✅ Polling state reset successfully');
    
  } catch (error) {
    console.error('Error resetting polling state:', error);
  } finally {
    await redis.quit();
  }
}

// Handle command line arguments
const command = process.argv[2];

if (command === 'reset') {
  const tenantId = process.argv[3];
  const sourceType = process.argv[4];
  const instanceUrl = process.argv[5];
  
  if (!tenantId || !sourceType || !instanceUrl) {
    console.log('Usage: node monitor-polling-state.js reset <tenant_id> <source_type> <instance_url>');
    process.exit(1);
  }
  
  resetPollingState(tenantId, sourceType, instanceUrl);
} else {
  // Default to monitoring
  monitorPollingStates();
} 