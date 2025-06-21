#!/bin/bash

# Feedback Ingestion System - Docker Stop Script
# This script stops all services cleanly

echo "🛑 Stopping Feedback Ingestion System..."
echo "========================================"

# Stop all services
echo "📦 Stopping all services..."
docker compose down

# Optional: Remove volumes (uncomment if you want to clear all data)
# echo "🗑️  Removing volumes..."
# docker compose down -v

echo ""
echo "✅ All services stopped successfully!"
echo ""
echo "💡 To start again, run: ./docker-start.sh"
echo "💡 To remove all data, run: docker-compose down -v" 