#!/bin/bash

# Test MCP Daemon Services
set -e

echo "🧪 Testing MCP Daemon Services..."

# Check if services are running
echo "📡 Checking Memory MCP Service..."
curl -s http://localhost:3001/health || echo "❌ Memory service not available"

echo "📡 Checking API MCP Service..."
curl -s http://localhost:3002/health || echo "❌ API service not available"

echo ""
echo "📋 Testing Memory Service Tools..."
curl -s http://localhost:3001/tools | jq '.' || echo "❌ Memory tools not available"

echo ""
echo "📋 Testing API Service Tools..."
curl -s http://localhost:3002/tools | jq '.' || echo "❌ API tools not available"

echo ""
echo "💾 Testing Memory Remember..."
curl -X POST http://localhost:3001/tools/memory_remember \
  -H "Content-Type: application/json" \
  -d '{"content": "Test memory from daemon", "key": "test"}' | jq '.' || echo "❌ Memory remember failed"

echo ""
echo "🧠 Testing Memory Recall..."
curl -X POST http://localhost:3001/tools/memory_recall \
  -H "Content-Type: application/json" \
  -d '{"key": "test"}' | jq '.' || echo "❌ Memory recall failed"

echo ""
echo "✅ MCP Daemon tests completed!"
