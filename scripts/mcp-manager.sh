#!/bin/bash

# MCP Server Management Script
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_DIR="$PROJECT_ROOT/server"
PIDS_FILE="$PROJECT_ROOT/.mcp-pids"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[MCP Manager]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[MCP Manager]${NC} $1"
}

error() {
    echo -e "${RED}[MCP Manager]${NC} $1"
}

# Build MCP servers
build_mcp_servers() {
    log "Building MCP servers..."
    cd "$SERVER_DIR"
    npm run build:mcp-servers
    log "MCP servers built successfully"
}

# Start all MCP servers
start_mcp_servers() {
    log "Starting MCP servers..."
    
    # Make sure we have the dist directory
    if [ ! -d "$SERVER_DIR/dist/mcp-servers" ]; then
        warn "MCP servers not built, building now..."
        build_mcp_servers
    fi
    
    cd "$SERVER_DIR"
    
    # Start memory server
    log "Starting memory server..."
    node dist/mcp-servers/memory-server.js &
    MEMORY_PID=$!
    echo "memory:$MEMORY_PID" >> "$PIDS_FILE"
    
    # Start API server
    log "Starting dynamic MCP API server..."
    node dist/mcp-servers/dynamic-mcp-api-server.js &
    API_PID=$!
    echo "api:$API_PID" >> "$PIDS_FILE"
    
    log "MCP servers started:"
    log "  Memory Server PID: $MEMORY_PID"
    log "  API Server PID: $API_PID"
    log "PIDs saved to $PIDS_FILE"
}

# Stop all MCP servers
stop_mcp_servers() {
    if [ ! -f "$PIDS_FILE" ]; then
        warn "No PID file found, no servers to stop"
        return
    fi
    
    log "Stopping MCP servers..."
    
    while IFS=':' read -r name pid; do
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            log "Stopping $name server (PID: $pid)"
            kill "$pid"
        else
            warn "$name server (PID: $pid) not running"
        fi
    done < "$PIDS_FILE"
    
    rm -f "$PIDS_FILE"
    log "All MCP servers stopped"
}

# Check status of MCP servers
status_mcp_servers() {
    if [ ! -f "$PIDS_FILE" ]; then
        warn "No PID file found, no servers running"
        return
    fi
    
    log "MCP Server Status:"
    
    while IFS=':' read -r name pid; do
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            echo -e "  ${GREEN}✓${NC} $name server (PID: $pid) - Running"
        else
            echo -e "  ${RED}✗${NC} $name server (PID: $pid) - Not running"
        fi
    done < "$PIDS_FILE"
}

# Restart all MCP servers
restart_mcp_servers() {
    log "Restarting MCP servers..."
    stop_mcp_servers
    build_mcp_servers
    start_mcp_servers
}

# Main command handling
case "${1:-}" in
    "start")
        start_mcp_servers
        ;;
    "stop")
        stop_mcp_servers
        ;;
    "restart")
        restart_mcp_servers
        ;;
    "status")
        status_mcp_servers
        ;;
    "build")
        build_mcp_servers
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|build}"
        echo ""
        echo "Commands:"
        echo "  start   - Build and start all MCP servers"
        echo "  stop    - Stop all running MCP servers"
        echo "  restart - Stop, rebuild, and start all MCP servers"
        echo "  status  - Show status of MCP servers"
        echo "  build   - Build MCP servers without starting them"
        exit 1
        ;;
esac
