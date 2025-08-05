#!/bin/bash

# Dynamic MCP Quick Start Script
echo "🚀 Dynamic MCP Quick Start"
echo "=========================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file and add your API keys:"
    echo "   - OPENAI_API_KEY (get from: https://platform.openai.com/api-keys)"
    echo "   - GEMINI_API_KEY (get from: https://aistudio.google.com/app/apikey)"
    echo ""
    echo "After adding your API keys, run this script again."
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "🧹 Cleaning up previous containers..."
docker compose -f docker-compose.dev.yml down

echo "🏗️  Building containers..."
docker compose -f docker-compose.dev.yml build

echo "🚀 Starting Dynamic MCP system..."
docker compose -f docker-compose.dev.yml up -d

echo "⏳ Waiting for services to start..."
sleep 10

echo ""
echo "✅ Dynamic MCP is starting up!"
echo ""
echo "🌐 Access points:"
echo "   • Web Interface: http://localhost:5173"
echo "   • API Server: http://localhost:3000"
echo "   • Memory Daemon Health: http://localhost:3001/health"
echo "   • API Daemon Health: http://localhost:3002/health"
echo ""
echo "📊 Monitor logs with:"
echo "   docker compose -f docker-compose.dev.yml logs -f"
echo ""
echo "🛑 Stop all services with:"
echo "   docker compose -f docker-compose.dev.yml down"
echo ""
echo "🎯 Try registering an MCP server by chatting with the AI!"
echo "   Example: 'Show me all my MCP servers' or 'Add a new weather MCP server'"
