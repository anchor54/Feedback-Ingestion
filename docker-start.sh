#!/bin/bash

# Feedback Ingestion System - Docker Startup Script
# This script starts all services in the correct order

set -e

echo "🚀 Starting Feedback Ingestion System..."
echo "========================================"

# Function to check if a service is healthy
check_service_health() {
    local service_name=$1
    local max_attempts=30
    local attempt=1
    
    echo "⏳ Waiting for $service_name to be healthy..."
    
    while [ $attempt -le $max_attempts ]; do
        if docker compose ps $service_name | grep -q "healthy\|Up"; then
            echo "✅ $service_name is healthy"
            return 0
        fi
        
        echo "   Attempt $attempt/$max_attempts - $service_name not ready yet..."
        sleep 5
        attempt=$((attempt + 1))
    done
    
    echo "❌ $service_name failed to become healthy within expected time"
    return 1
}

# Function to wait for Kafka to be ready
wait_for_kafka() {
    echo "⏳ Waiting for Kafka to be ready..."
    local max_attempts=60
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker compose exec -T kafka kafka-topics --bootstrap-server localhost:9092 --list >/dev/null 2>&1; then
            echo "✅ Kafka is ready"
            return 0
        fi
        
        echo "   Attempt $attempt/$max_attempts - Kafka not ready yet..."
        sleep 5
        attempt=$((attempt + 1))
    done
    
    echo "❌ Kafka failed to become ready"
    return 1
}

# Clean up function
cleanup() {
    echo "🧹 Cleaning up..."
    docker compose down
    exit 1
}

# Set up trap for cleanup on script exit
trap cleanup INT TERM

# Start infrastructure services first
echo "📦 Starting infrastructure services..."
docker compose up -d zookeeper kafka mongodb redis kafka-ui

# Wait for infrastructure to be ready
echo "⏳ Waiting for infrastructure services..."
sleep 10

# Check MongoDB
echo "🔍 Checking MongoDB..."
docker compose exec -T mongodb mongosh --eval "db.adminCommand('ismaster')" >/dev/null 2>&1 || {
    echo "❌ MongoDB not ready"
    exit 1
}
echo "✅ MongoDB is ready"

# Check Redis
echo "🔍 Checking Redis..."
docker compose exec -T redis redis-cli ping >/dev/null 2>&1 || {
    echo "❌ Redis not ready"
    exit 1
}
echo "✅ Redis is ready"

# Wait for Kafka
wait_for_kafka

# Create Kafka topic if it doesn't exist
echo "📝 Creating Kafka topic..."
docker compose exec -T kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists --topic feedback-ingestion --partitions 3 --replication-factor 1

# Start application services
echo "🎯 Starting application services..."
docker compose up -d webhook-service processing-service polling-service

# Wait for webhook service to be healthy
check_service_health webhook-service

echo ""
echo "🎉 All services started successfully!"
echo ""
echo "📋 Service Status:"
echo "=================="
docker compose ps

echo ""
echo "🔗 Service URLs:"
echo "==============="
echo "• Webhook Service:    http://localhost:3000"
echo "• Webhook Health:     http://localhost:3000/health"
echo "• Webhook Info:       http://localhost:3000/webhooks/info"
echo "• Kafka UI:           http://localhost:8080"
echo "• MongoDB:            mongodb://localhost:27017"
echo "• Redis:              redis://localhost:6379"

echo ""
echo "🧪 Test Commands:"
echo "================"
echo "# Test webhook endpoint:"
echo "curl http://localhost:3000/health"
echo ""
echo "# Send test webhook:"
echo "curl -X POST http://localhost:3000/webhooks/DISCOURSE/tenant_123 \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"id\": 12345, \"username\": \"testuser\", \"created_at\": \"2023-12-01T10:00:00Z\", \"cooked\": \"<p>Test post</p>\", \"topic_id\": 456}'"

echo ""
echo "📊 Monitoring Commands:"
echo "======================"
echo "# View logs:"
echo "docker compose logs -f webhook-service"
echo "docker compose logs -f processing-service"
echo "docker compose logs -f polling-service"
echo ""
echo "# Check service status:"
echo "docker compose ps"

echo ""
echo "✅ Setup complete! All services are running." 