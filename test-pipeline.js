const axios = require('axios');

const testWebhook = async () => {
  try {
    const testData = {
      id: "12345",
      title: "Test Discourse Post",
      raw: "This is a test post content from Discourse",
      username: "testuser",
      name: "Test User",
      user_id: "67890",
      created_at: new Date().toISOString(),
      topic_id: 123,
      post_number: 1,
      like_count: 5,
      reads: 10,
      instance_url: "https://discourse.example.com"
    };

    console.log('Sending test webhook...');
    const response = await axios.post('http://localhost:3000/webhooks/discourse/test_tenant_123', testData, {
      headers: {
        'Content-Type': 'application/json',
        'X-Discourse-Instance': 'https://discourse.example.com'
      }
    });

    console.log('Response:', response.data);
    console.log('✅ Test webhook sent successfully!');
    
  } catch (error) {
    console.error('❌ Error sending test webhook:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
};

testWebhook(); 