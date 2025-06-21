# Webhook Testing Guide

This guide explains how to test your feedback ingestion webhook service using the provided dummy webhook sender tools.

## Overview

The webhook testing tools simulate external services (Discourse, Intercom, Playstore) sending webhook data to your webhook receiver service. This allows you to test the entire pipeline without needing real external APIs.

## Prerequisites

Before testing, ensure the following services are running:

1. **Infrastructure** (via Docker Compose):
   ```bash
   docker-compose up -d
   ```

2. **Webhook Service**:
   ```bash
   npm run dev:webhook
   # or
   npm run build && npm start
   ```

3. **Processing Service** (to consume from Kafka):
   ```bash
   npm run dev:processor
   ```

4. **MongoDB** - Should be running via Docker Compose
5. **Kafka** - Should be running via Docker Compose
6. **Redis** - Should be running via Docker Compose

## Testing Methods

### 1. Interactive Testing Tool (Recommended)

The interactive tool provides a menu-driven interface for testing:

```bash
npm run test:webhook:interactive
```

This will show a menu with options to:
- Send single webhooks
- Send burst of webhooks
- Start/stop continuous sending
- Check sender status
- Test all source types
- Get help

### 2. Command Line Testing

#### Quick Start
```bash
npm run test:webhook
```

#### Send Single Webhook
```bash
npm run test:webhook:single
# or with specific parameters
npm run build && node test-webhook-sender.js single DISCOURSE tenant_discourse_123
```

#### Send Burst of Webhooks
```bash
npm run test:webhook:burst
# or with specific parameters
npm run build && node test-webhook-sender.js burst INTERCOM tenant_intercom_456 10
```

#### Start Continuous Sending
```bash
npm run test:webhook:continuous
```

#### Check Status
```bash
npm run build && node test-webhook-sender.js status
```

## Available Source Types

The testing tools support three source types with realistic test data:

### 1. DISCOURSE
- **Tenant ID**: `tenant_discourse_123`
- **Webhook URL**: `http://localhost:3000/webhooks/discourse/tenant_discourse_123`
- **Interval**: Every 30 seconds (continuous mode)
- **Data**: Simulates forum posts with topics, content, user info, and metadata

### 2. INTERCOM
- **Tenant ID**: `tenant_intercom_456`
- **Webhook URL**: `http://localhost:3000/webhooks/intercom/tenant_intercom_456`
- **Interval**: Every 45 seconds (continuous mode)
- **Data**: Simulates customer support messages with conversations and priorities

### 3. PLAYSTORE
- **Tenant ID**: `tenant_playstore_789`
- **Webhook URL**: `http://localhost:3000/webhooks/playstore/tenant_playstore_789`
- **Interval**: Every 60 seconds (continuous mode)
- **Data**: Simulates app reviews with ratings, package names, and device info

## Sample Test Data

### Discourse Webhook Payload
```json
{
  "id": 123456,
  "name": "Test User",
  "username": "john_doe",
  "created_at": "2023-12-01T10:30:00.000Z",
  "updated_at": "2023-12-01T10:30:00.000Z",
  "cooked": "<p>I'm experiencing login issues with the new update.</p>",
  "post_number": 25,
  "topic_id": 456,
  "topic_title_headline": "Bug Report: Login Issues",
  "like_count": 3,
  "reads": 45,
  "instance_url": "https://discourse.example.com"
}
```

### Intercom Webhook Payload
```json
{
  "id": "msg_123456",
  "conversation_id": "conv_789",
  "subject": "Account Setup Help",
  "body": "Hi, I need help setting up my account.",
  "created_at": "2023-12-01T10:30:00.000Z",
  "message_type": "customer",
  "priority": "medium",
  "author": {
    "id": "user_456",
    "name": "Test Customer",
    "username": "test_customer"
  }
}
```

### Playstore Webhook Payload
```json
{
  "reviewId": "review_123456",
  "packageName": "com.example.todoapp",
  "authorName": "App User",
  "text": "Great app! Really helpful for organizing my tasks.",
  "starRating": 5,
  "created_at": "2023-12-01T10:30:00.000Z",
  "language": "en",
  "appVersionName": "2.1.3",
  "device": "Samsung Galaxy S21"
}
```

## Webhook Headers

The testing tools include realistic headers for each source type:

### Discourse Headers
- `X-Discourse-Instance`: Instance URL
- `X-Discourse-Event`: Event type
- `X-Discourse-Event-Signature`: HMAC signature

### Intercom Headers
- `X-Intercom-Webhook-Id`: Webhook ID
- `X-Intercom-Hmac-SHA256`: HMAC signature

### Playstore Headers
- `X-Playstore-Notification-Type`: Notification type
- `X-Playstore-Package-Name`: App package name

## Verifying the Pipeline

### 1. Check Webhook Service Logs
Look for successful webhook receipts:
```
✅ Webhook received: DISCOURSE for tenant_discourse_123
📤 Published to Kafka: correlation_id_123
```

### 2. Check Kafka Messages
Use Kafka UI at http://localhost:8080 to verify messages in the `feedback-ingestion` topic.

### 3. Check Processing Service Logs
Look for successful processing:
```
✅ Processed message: correlation_id_123
💾 Stored feedback record for tenant_discourse_123
```

### 4. Check MongoDB
Verify data is stored in the `feedback_records` collection:
```bash
# Connect to MongoDB
docker exec -it enterpret-mongodb-1 mongosh

# Query the database
use feedback_db
db.feedback_records.find().limit(5).pretty()
```

## Testing Scenarios

### Basic Functionality Test
1. Start webhook service
2. Start processing service
3. Send single webhook for each source type
4. Verify data appears in MongoDB

### Load Testing
1. Send burst of 50 webhooks
2. Monitor processing latency
3. Check for any dropped messages

### Continuous Testing
1. Start continuous sending
2. Let it run for 10-15 minutes
3. Monitor system performance
4. Check for memory leaks or errors

### Error Handling Test
1. Stop MongoDB temporarily
2. Send webhooks
3. Restart MongoDB
4. Verify messages are eventually processed

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Ensure webhook service is running on port 3000
   - Check if port is available: `lsof -i :3000`

2. **Kafka Connection Errors**
   - Verify Kafka is running: `docker-compose ps`
   - Check Kafka logs: `docker-compose logs kafka`

3. **No Data in MongoDB**
   - Check processing service is running
   - Verify Kafka topic exists
   - Check processing service logs for errors

4. **Webhook Signature Verification Fails**
   - The dummy service uses test secrets
   - Ensure webhook service accepts test signatures

### Debugging Commands

```bash
# Check all services
docker-compose ps

# View logs
docker-compose logs webhook-service
docker-compose logs processing-service
docker-compose logs kafka

# Check Kafka topics
docker exec -it enterpret-kafka-1 kafka-topics.sh --list --bootstrap-server localhost:9092

# Monitor Kafka messages
docker exec -it enterpret-kafka-1 kafka-console-consumer.sh --topic feedback-ingestion --bootstrap-server localhost:9092 --from-beginning
```

## Performance Metrics

Monitor these metrics during testing:

- **Webhook Response Time**: Should be < 100ms
- **Kafka Publishing Latency**: Should be < 50ms
- **Processing Latency**: Should be < 500ms per message
- **End-to-End Latency**: Should be < 1 second
- **Throughput**: Should handle 100+ webhooks/second
- **Error Rate**: Should be < 1%

## Advanced Testing

### Custom Payload Testing
Modify the payload generators in `src/testing/dummyWebhookSender.ts` to test edge cases:
- Missing fields
- Invalid data types
- Very large payloads
- Special characters

### Webhook Signature Testing
Test signature verification by:
- Sending webhooks with invalid signatures
- Testing different signature algorithms
- Verifying security headers

### Multi-tenant Testing
- Send webhooks for different tenant IDs
- Verify data isolation
- Test tenant-specific configurations

## Cleanup

After testing, clean up resources:

```bash
# Stop webhook sender
Ctrl+C (if running continuously)

# Stop services
docker-compose down

# Clean up test data (optional)
docker exec -it enterpret-mongodb-1 mongosh
> use feedback_db
> db.feedback_records.deleteMany({})
```

## Next Steps

After successful webhook testing:
1. Test the polling service with real APIs
2. Set up monitoring and alerting
3. Configure production webhooks
4. Implement webhook signature verification
5. Add rate limiting and security measures 