# Feedback Ingestion System

A scalable, multi-tenant feedback ingestion system that supports heterogeneous data sources through both push (webhook) and pull (polling) integration models.

## 📋 Problem Statement

Modern applications need to collect feedback from multiple sources to understand user sentiment and improve their products. However, each feedback source has different:

- **Data formats**: JSON structures vary between Discourse, Intercom, Play Store, etc.
- **Integration methods**: Some support webhooks (push), others require API polling (pull)
- **Authentication**: Different API keys, tokens, and security mechanisms
- **Rate limits**: Varying request limits and throttling policies
- **Metadata**: Source-specific fields like app versions, countries, conversation IDs

### Challenges

1. **Heterogeneity**: Each source has unique data structures and APIs
2. **Scale**: Need to handle high-volume feedback from multiple tenants
3. **Reliability**: Ensure no data loss with proper error handling and retries
4. **Multi-tenancy**: Isolate data between different customers/organizations
5. **Idempotency**: Prevent duplicate records when processing the same feedback
6. **Extensibility**: Easy addition of new feedback sources

## 🏗️ Solution Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   External      │    │   Ingestion     │    │   Processing    │
│   Sources       │───▶│   Layer         │───▶│   Pipeline      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │     Kafka       │    │    MongoDB      │
                       │   (Queue)       │    │   (Storage)     │
                       └─────────────────┘    └─────────────────┘
```

### Component Architecture

#### 1. **Ingestion Layer**
- **Webhook Service**: Receives push notifications from external sources
- **Polling Service**: Actively polls APIs for new feedback
- **Handler Registry**: Routes requests to source-specific processors

#### 2. **Message Queue (Kafka)**
- Decouples ingestion from processing
- Ensures reliability and scalability
- Topic: `feedback-ingestion`

#### 3. **Processing Pipeline**
- **Transformers**: Convert source-specific data to unified format
- **Filters**: Generate idempotency filters for deduplication
- **Storage**: Upsert operations to MongoDB

#### 4. **Storage Layer (MongoDB)**
- **Feedback Collection**: Stores unified feedback records
- **Polling Config Collection**: Manages API polling configurations
- **Unique Indexes**: Ensures idempotency per tenant/source/instance

#### 5. **Supporting Services**
- **Redis**: Rate limiting and polling state management
- **Rate Limiter**: Distributed rate limiting per tenant/source

## 🔄 Integration Models

### Push Model (Webhooks)

External sources send HTTP POST requests to your webhook endpoints when new feedback is created.

**Flow:**
```
External Source → Webhook Endpoint → Kafka → Processing → MongoDB
```

**Endpoint Pattern:**
```
POST /webhooks/{SOURCE_TYPE}/{TENANT_ID}
```

**Supported Sources:**
- **Discourse**: Forum posts and comments
- **Intercom**: Customer support messages
- **Play Store**: App reviews and ratings

**Example Webhook URL:**
```
POST /webhooks/DISCOURSE/tenant_123
```

### Pull Model (Polling)

The system actively polls external APIs at configured intervals to fetch new feedback.

**Flow:**
```
Polling Service → External API → Kafka → Processing → MongoDB
```

**Configuration-Driven:**
- Database-stored polling configurations
- Configurable intervals, authentication, pagination
- Automatic failure handling and backoff

**Example Polling Config:**
```json
{
  "tenant_id": "tenant_123",
  "source_type": "DISCOURSE",
  "instance_url": "https://forum.example.com",
  "api_config": {
    "endpoint": "/search.json",
    "auth": {
      "type": "api_key",
      "api_key_header": "Api-Key",
      "api_key_value": "your-api-key"
    }
  },
  "polling_config": {
    "interval_seconds": 300,
    "enabled": true
  }
}
```

## 🔌 Adding New Sources

The system is designed for easy extensibility. Here's how to add a new source:

### 1. For Webhook Sources

**Step 1: Create Webhook Handler**
```typescript
// src/services/webhook/handlers/NewSourceWebhookHandler.ts
export class NewSourceWebhookHandler extends WebhookHandler {
  canHandle(sourceType: SourceType): boolean {
    return sourceType === SourceType.NEW_SOURCE;
  }

  async validatePayload(context: WebhookContext): Promise<boolean> {
    // Implement signature validation
    return true;
  }

  async extractSourceConfig(context: WebhookContext): Promise<any> {
    // Extract source-specific configuration
    return { instance_url: context.request.headers['x-source-instance'] };
  }
}
```

**Step 2: Register Handler**
```typescript
// src/services/webhook/handlers/index.ts
webhookHandlerRegistry.registerHandler(new NewSourceWebhookHandler());
```

**Step 3: Create Transformer**
```typescript
// src/services/processing/transformers.ts
export const transformNewSourceData = (message: QueueMessage): Partial<IFeedback> => {
  // Transform raw data to unified format
  return {
    tenant_id: message.tenant_id,
    source_info: {
      type: SourceType.NEW_SOURCE,
      source_id: message.raw_data.id,
      instance_url: message.source_config?.instance_url
    },
    // ... rest of transformation
  };
};
```

### 2. For Polling Sources

**Step 1: Create Polling Behavior**
```typescript
// src/services/polling/behaviors/NewSourcePollingBehavior.ts
export class NewSourcePollingBehavior extends PollingBehavior {
  canHandle(sourceType: string): boolean {
    return sourceType === SourceType.NEW_SOURCE;
  }

  async poll(context: PollingContext): Promise<PollingResult> {
    // Implement API polling logic
    const response = await this.makeApiCall(context.config);
    return {
      data: response.data,
      hasMore: response.hasNextPage,
      nextCursor: response.nextPageToken
    };
  }
}
```

**Step 2: Register Behavior**
```typescript
// src/services/polling/behaviors/index.ts
pollingBehaviorRegistry.registerBehavior(new NewSourcePollingBehavior());
```

## 🚀 Setup and Installation

### Prerequisites

- **Node.js** 18+ and npm
- **Docker** and Docker Compose
- **Git**

### Quick Start with Docker (Recommended)

The fastest way to get the entire system running:

```bash
# 1. Clone repository
git clone <repository-url>
cd feedback-ingestion-system

# 2. Start all services with one command
./docker-start.sh
```

This will automatically:
- Start all infrastructure services (Kafka, MongoDB, Redis)
- Build and start application services
- Create necessary Kafka topics
- Perform health checks
- Display service URLs and test commands

**🔗 Service URLs:**
- **Webhook Service**: `http://localhost:3000`
- **Kafka UI**: `http://localhost:8080`
- **MongoDB**: `mongodb://localhost:27017`
- **Redis**: `redis://localhost:6379`

### Alternative: Local Development Setup

For development with hot reloading:

#### 1. Clone Repository
```bash
git clone <repository-url>
cd feedback-ingestion-system
```

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Start Infrastructure Only
```bash
# Start Kafka, MongoDB, Redis (infrastructure only)
npm run docker:dev
```

#### 4. Build the Application
```bash
npm run build
```

#### 5. Start Application Services Locally

Open **3 separate terminals** and run:

**Terminal 1: Webhook Service**
```bash
npm run dev:webhook
```

**Terminal 2: Processing Service**
```bash
npm run dev:processor
```

**Terminal 3: Polling Service**
```bash
npm run dev:polling
```

### Verify Setup

**Check Health Endpoint:**
```bash
curl http://localhost:3000/health
```

**View Webhook Handler Info:**
```bash
curl http://localhost:3000/webhooks/info
```

### Docker Management Commands

```bash
# Start all services
npm run docker:start

# Stop all services
npm run docker:stop

# View logs
npm run docker:logs

# View specific service logs
npm run docker:logs:webhook
npm run docker:logs:processor
npm run docker:logs:polling
```

📖 **For detailed Docker setup, troubleshooting, and production deployment, see [DOCKER_SETUP.md](./DOCKER_SETUP.md)**

## 🧪 Testing the System

### Interactive Testing Tool

```bash
npm run test:webhook:interactive
```

This launches an interactive CLI tool with options to:
- Send single webhooks
- Send burst of webhooks  
- Start/stop continuous sending
- Test all source types
- Check sender status

### Manual Testing

**Send Single Webhook:**
```bash
npm run test:webhook:single
```

**Send Burst of Webhooks:**
```bash
npm run test:webhook:burst
```

**Start Continuous Sending:**
```bash
npm run test:webhook:continuous
```

### Test Webhook Endpoints

**Discourse Webhook:**
```bash
curl -X POST http://localhost:3000/webhooks/DISCOURSE/tenant_123 \
  -H "Content-Type: application/json" \
  -d '{
    "id": 12345,
    "username": "testuser",
    "created_at": "2023-12-01T10:00:00Z",
    "cooked": "<p>This is a test post</p>",
    "topic_id": 456,
    "topic_title_headline": "Test Topic"
  }'
```

**Intercom Webhook:**
```bash
curl -X POST http://localhost:3000/webhooks/INTERCOM/tenant_456 \
  -H "Content-Type: application/json" \
  -d '{
    "id": "msg_123",
    "conversation_id": "conv_456",
    "body": "Hello, I need help!",
    "created_at": "2023-12-01T10:00:00Z",
    "author": {"name": "Customer", "id": "user_789"}
  }'
```

## 📊 Monitoring and Observability

### Kafka UI
- **URL**: `http://localhost:8080`
- **Purpose**: Monitor Kafka topics, messages, and consumer groups
- **Topic**: `feedback-ingestion`

### MongoDB
```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/feedback-ingestion

# View feedback records
db.feedbacks.find().limit(5)

# Check polling configurations
db.pollingconfigs.find()
```

### Application Logs
All services provide structured logging with correlation IDs:

```bash
# Webhook service logs
npm run dev:webhook

# Processing service logs  
npm run dev:processor

# Polling service logs
npm run dev:polling
```

### Polling State Monitoring

```bash
# Check polling states for all tenants
node monitor-polling-state.js

# Reset polling state for specific tenant/source
node monitor-polling-state.js reset tenant_123 DISCOURSE https://forum.example.com
```

## 🔧 Configuration

### Environment Variables

Create `.env` file:
```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/feedback-ingestion

# Kafka
KAFKA_BROKERS=localhost:9092

# Redis
REDIS_URL=redis://localhost:6379

# Application
PORT=3000
NODE_ENV=development
```

### Polling Configuration

Add polling configurations via MongoDB:

```javascript
// Example: Add Discourse polling config
db.pollingconfigs.insertOne({
  tenant_id: "tenant_123",
  source_type: "DISCOURSE",
  instance_url: "https://meta.discourse.org",
  api_config: {
    endpoint: "/search.json",
    method: "GET",
    query_params: {
      "q": "after:2023-01-01"
    }
  },
  polling_config: {
    interval_seconds: 300,
    enabled: true,
    max_failures_before_disable: 5
  },
  rate_limiting: {
    requests_per_minute: 60,
    requests_per_hour: 1000
  }
})
```

## 📈 Production Considerations

### Scaling
- **Horizontal Scaling**: Run multiple instances of each service
- **Kafka Partitioning**: Partition by tenant_id for parallel processing
- **MongoDB Sharding**: Shard by tenant_id for data distribution

### Security
- **API Authentication**: Implement proper webhook signature validation
- **Network Security**: Use VPCs, security groups, and TLS
- **Secrets Management**: Use proper secret management systems

### Monitoring
- **Metrics**: Implement Prometheus/Grafana for metrics
- **Alerting**: Set up alerts for failures, queue length, processing delays
- **Health Checks**: Implement comprehensive health endpoints

### Backup and Recovery
- **MongoDB Backups**: Regular automated backups
- **Kafka Retention**: Configure appropriate message retention
- **Disaster Recovery**: Multi-region deployment strategies

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/new-source`)
3. **Commit** your changes (`git commit -am 'Add new source support'`)
4. **Push** to the branch (`git push origin feature/new-source`)
5. **Create** a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Troubleshooting

### Common Issues

**1. Kafka Connection Issues**
```bash
# Restart Kafka services
docker compose restart kafka zookeeper

# Check Kafka logs
docker compose logs kafka
```

**2. MongoDB Connection Issues**
```bash
# Restart MongoDB
docker compose restart mongodb

# Check MongoDB logs
docker compose logs mongodb
```

**3. Webhook 400 Errors**
- Ensure source type is uppercase in URL (DISCOURSE, not discourse)
- Check request payload format matches expected structure

**4. No Data Being Processed**
- Verify all 3 services are running (webhook, processor, polling)
- Check Kafka UI for messages in `feedback-ingestion` topic
- Review application logs for errors

### Getting Help

1. **Check Logs**: Review application and Docker container logs
2. **Kafka UI**: Monitor message flow through `http://localhost:8080`
3. **MongoDB**: Query database directly to verify data storage
4. **Health Endpoints**: Use `/health` and `/webhooks/info` endpoints

For additional support, please create an issue in the repository with:
- Error messages and logs
- Steps to reproduce
- Environment details 