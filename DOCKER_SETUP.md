# Docker Setup Guide

This guide provides instructions for running the Feedback Ingestion System using Docker containers.

## 🐳 Docker Architecture

The system runs as multiple containerized services:

### Infrastructure Services
- **Zookeeper**: Kafka coordination
- **Kafka**: Message queue with 3 partitions
- **MongoDB**: Primary data storage
- **Redis**: Rate limiting and state management
- **Kafka UI**: Web interface for Kafka monitoring

### Application Services
- **Webhook Service**: HTTP endpoint for receiving webhooks (Port 3000)
- **Processing Service**: Kafka consumer for data transformation and storage
- **Polling Service**: API polling and data ingestion

## 🚀 Quick Start

### Option 1: Full Production Setup (Recommended)

```bash
# Start all services with proper health checks and ordering
./docker-start.sh
```

This script will:
1. Start infrastructure services (Kafka, MongoDB, Redis)
2. Wait for services to be ready
3. Create Kafka topics
4. Start application services
5. Verify health checks
6. Display service URLs and test commands

### Option 2: Manual Docker Compose

```bash
# Start all services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

### Option 3: Development Mode (Infrastructure Only)

```bash
# Start only infrastructure services for local development
npm run docker:dev

# Run application services locally
npm run dev:webhook    # Terminal 1
npm run dev:processor  # Terminal 2
npm run dev:polling    # Terminal 3
```

## 📦 Available Scripts

```bash
# Production Docker commands
npm run docker:start        # Start all services with health checks
npm run docker:stop         # Stop all services
npm run docker:build        # Build application images
npm run docker:logs         # View all service logs

# Service-specific logs
npm run docker:logs:webhook    # Webhook service logs only
npm run docker:logs:processor  # Processing service logs only
npm run docker:logs:polling    # Polling service logs only

# Development Docker commands
npm run docker:dev           # Start infrastructure only
npm run docker:dev:stop      # Stop development infrastructure
```

## 🔍 Service Health Checks

### Webhook Service
```bash
# Health check endpoint
curl http://localhost:3000/health

# Service information
curl http://localhost:3000/webhooks/info
```

### Infrastructure Services
```bash
# MongoDB
docker compose exec mongodb mongosh --eval "db.adminCommand('ismaster')"

# Redis
docker compose exec redis redis-cli ping

# Kafka
docker compose exec kafka kafka-topics --bootstrap-server localhost:9092 --list
```

## 🧪 Testing the Containerized System

### 1. Basic Health Check
```bash
curl http://localhost:3000/health
```

### 2. Send Test Webhook
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

### 3. Use Interactive Testing Tool
```bash
# Build and run the testing tool in a container
docker run --rm -it --network host \
  $(docker compose images -q webhook-service) \
  node test-webhooks-interactive.js
```

## 📊 Monitoring

### Kafka UI
- **URL**: http://localhost:8080
- **Topic**: `feedback-ingestion`
- **Consumer Groups**: Monitor processing service consumption

### Application Logs
```bash
# Real-time logs from all services
docker compose logs -f

# Specific service logs
docker compose logs -f webhook-service
docker compose logs -f processing-service
docker compose logs -f polling-service

# Infrastructure logs
docker compose logs -f kafka
docker compose logs -f mongodb
docker compose logs -f redis
```

### Database Access
```bash
# MongoDB shell
docker compose exec mongodb mongosh feedback-ingestion

# Redis CLI
docker compose exec redis redis-cli
```

## 🔧 Configuration

### Environment Variables

The Docker setup uses these environment variables:

```yaml
# Application Services
NODE_ENV: production
MONGODB_URI: mongodb://mongodb:27017/feedback-ingestion
KAFKA_BROKERS: kafka:29092
REDIS_URL: redis://redis:6379
PORT: 3000
```

### Custom Configuration

Create a `.env` file to override defaults:

```env
# Custom MongoDB URI
MONGODB_URI=mongodb://mongodb:27017/my-feedback-db

# Custom Kafka settings
KAFKA_BROKERS=kafka:29092

# Custom Redis settings
REDIS_URL=redis://redis:6379

# Application settings
NODE_ENV=production
LOG_LEVEL=info
```

## 🐛 Troubleshooting

### Common Issues

**1. Services Not Starting**
```bash
# Check Docker and Docker Compose versions
docker --version
docker compose version

# Check available system resources
docker system df
docker system prune  # Clean up if needed
```

**2. Port Conflicts**
```bash
# Check what's using ports
sudo netstat -tulpn | grep :3000
sudo netstat -tulpn | grep :9092
sudo netstat -tulpn | grep :27017

# Stop conflicting services
sudo systemctl stop mongodb  # If local MongoDB is running
```

**3. Kafka Connection Issues**
```bash
# Restart Kafka services
docker compose restart zookeeper kafka

# Check Kafka logs
docker compose logs kafka

# Verify topic creation
docker compose exec kafka kafka-topics --bootstrap-server localhost:9092 --list
```

**4. Application Service Failures**
```bash
# Check service logs
docker compose logs webhook-service
docker compose logs processing-service
docker compose logs polling-service

# Restart specific service
docker compose restart webhook-service

# Rebuild and restart
docker compose build webhook-service
docker compose up -d webhook-service
```

**5. Health Check Failures**
```bash
# Check webhook service health
curl -v http://localhost:3000/health

# Check container status
docker compose ps

# Inspect container
docker inspect $(docker compose ps -q webhook-service)
```

### Service Dependencies

The services start in this order:
1. **Zookeeper** → **Kafka** → **Kafka UI**
2. **MongoDB**, **Redis** (parallel)
3. **Webhook Service** (waits for all infrastructure)
4. **Processing Service** (waits for webhook service)
5. **Polling Service** (waits for processing service)

### Performance Tuning

**For Production:**

```yaml
# In docker-compose.yml, add resource limits
services:
  webhook-service:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'
```

**Kafka Optimization:**
```bash
# Increase partitions for better throughput
docker compose exec kafka kafka-topics --bootstrap-server localhost:9092 \
  --alter --topic feedback-ingestion --partitions 6
```

## 🔒 Security Considerations

### Production Deployment

1. **Use Docker Secrets** for sensitive data
2. **Enable TLS** for all inter-service communication
3. **Use private networks** instead of host networking
4. **Implement proper authentication** for MongoDB and Redis
5. **Use non-root users** in containers (already implemented)

### Network Security
```yaml
# Example production network setup
networks:
  backend:
    driver: bridge
    internal: true
  frontend:
    driver: bridge

services:
  webhook-service:
    networks:
      - frontend
      - backend
  # Internal services only on backend network
```

## 📈 Scaling

### Horizontal Scaling

```bash
# Scale webhook service
docker compose up -d --scale webhook-service=3

# Scale processing service
docker compose up -d --scale processing-service=2
```

### Load Balancer Setup

```yaml
# Add nginx load balancer
nginx:
  image: nginx:alpine
  ports:
    - "80:80"
  volumes:
    - ./nginx.conf:/etc/nginx/nginx.conf
  depends_on:
    - webhook-service
```

## 🛑 Cleanup

### Stop Services
```bash
# Stop all services
./docker-stop.sh

# Or manually
docker compose down
```

### Remove All Data
```bash
# Stop and remove volumes (⚠️ This deletes all data)
docker compose down -v

# Remove images
docker compose down --rmi all

# Complete cleanup
docker system prune -a --volumes
```

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Kafka Docker Documentation](https://hub.docker.com/r/confluentinc/cp-kafka)
- [MongoDB Docker Documentation](https://hub.docker.com/_/mongo)
- [Redis Docker Documentation](https://hub.docker.com/_/redis) 