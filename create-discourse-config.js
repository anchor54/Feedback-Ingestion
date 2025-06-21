const mongoose = require('mongoose');
const { SourceType } = require('./src/common/types');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/feedback-ingestion');

// Define the schema (simplified version)
const PollingConfigSchema = new mongoose.Schema({
  tenant_id: String,
  source_type: SourceType,
  instance_url: String,
  api_config: {
    endpoint: String,
    method: { type: String, default: 'GET' },
    headers: Object,
    query_params: Object,
    auth: {
      type: { type: String },  // Explicit syntax to avoid conflict with Mongoose's type field
      api_key_header: String,
      api_key_value: String,
      username: String
    }
  },
  polling_config: {
    interval_seconds: Number,
    enabled: { type: Boolean, default: true },
    consecutive_failures: { type: Number, default: 0 },
    max_failures_before_disable: { type: Number, default: 5 }
  },
  data_extraction: {
    response_path: String,
    pagination: {
      type: { type: String },
      limit_param: String,
      offset_param: String
    }
  },
  rate_limiting: {
    requests_per_minute: { type: Number, default: 60 },
    requests_per_hour: { type: Number, default: 1000 }
  }
}, { timestamps: true });

const PollingConfig = mongoose.model('PollingConfig', PollingConfigSchema);

async function createDiscourseConfig() {
  try {
    // Discourse configuration using the assignment's API examples
    const discourseConfig = new PollingConfig({
      tenant_id: 'test_tenant_discourse',
      source_type: SourceType.DISCOURSE,
      instance_url: 'https://meta.discourse.org',
      api_config: {
        endpoint: 'https://meta.discourse.org/search.json', // This will be used by the specialized client
        method: 'GET',
        headers: {
          'User-Agent': 'Enterpret-Feedback-Ingestion/1.0',
          'Accept': 'application/json'
        },
        auth: {
          type: 'api_key',
          // Note: For production, you would add your Discourse API credentials here
          // api_key_header: 'Api-Key',
          // api_key_value: 'your_discourse_api_key',
          // username: 'your_discourse_username'
        }
      },
      polling_config: {
        interval_seconds: 300, // Poll every 5 minutes
        enabled: true
      },
      data_extraction: {
        // The specialized Discourse client handles the complex two-step process
        // No need for response_path as it's handled internally
      },
      rate_limiting: {
        requests_per_minute: 30, // Conservative rate limiting
        requests_per_hour: 500
      }
    });

    // Save configuration
    await discourseConfig.save();
    console.log('✅ Created Discourse polling configuration');

    console.log('\n📋 Discourse configuration created successfully!');
    console.log('\n🔧 Configuration details:');
    console.log('- Instance: https://meta.discourse.org');
    console.log('- Polling interval: 5 minutes');
    console.log('- Uses specialized two-step API process:');
    console.log('  1. Search posts in time range: /search.json');
    console.log('  2. Fetch detailed post content: /t/{topic_id}/posts.json');
    
    console.log('\n🚀 To test the Discourse integration:');
    console.log('1. Start the polling service: npm run dev:polling');
    console.log('2. Start the processor: npm run dev:processor');
    console.log('3. Watch the logs for Discourse polling activity');
    console.log('4. Check MongoDB for ingested posts');

    console.log('\n📝 Note: This configuration uses the public meta.discourse.org API');
    console.log('For production use with your own Discourse instance:');
    console.log('1. Update instance_url to your Discourse URL');
    console.log('2. Add API credentials (api_key_value and username)');
    console.log('3. Adjust rate limits based on your API limits');

  } catch (error) {
    console.error('❌ Error creating Discourse configuration:', error);
  } finally {
    await mongoose.disconnect();
  }
}

createDiscourseConfig(); 