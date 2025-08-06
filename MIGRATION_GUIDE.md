# Migration Guide: Endpoint Configuration Update

This guide helps you migrate from the previous hardcoded endpoint system to the new configurable HTTP endpoint system.

## 🚀 What's New

### Before (Hardcoded Endpoints)
```typescript
// System always used these paths:
const toolUrl = `${baseUrl}/call-tool`     // Fixed
const healthUrl = `${baseUrl}/health`       // Fixed  
const toolsUrl = `${baseUrl}/tools`         // Fixed
```

### After (Configurable Endpoints)
```typescript
// System uses your custom paths:
const toolUrl = `${baseUrl}${server.transportToolEndpoint || '/call-tool'}`
const healthUrl = `${baseUrl}${server.transportHealthEndpoint || '/health'}`
const toolsUrl = `${baseUrl}${server.transportToolsEndpoint || '/tools'}`
```

## 🔄 Migration Steps

### Step 1: Update Database Schema

```bash
# Apply database migration
npx prisma migrate dev --name add_endpoint_configs

# Or if using Docker:
docker-compose exec server npx prisma migrate deploy
```

This adds 4 new columns to the `MCPServer` table:
- `transportToolEndpoint`
- `transportHealthEndpoint` 
- `transportToolsEndpoint`
- `transportResourcesEndpoint`

### Step 2: Verify Built-in Servers

Built-in servers are automatically updated with explicit endpoint configuration:

```sql
-- Check built-in servers have proper endpoints
SELECT name, "transportToolEndpoint", "transportHealthEndpoint" 
FROM "MCPServer" 
WHERE name IN ('memory-daemon', 'dynamic-mcp-api-daemon');
```

Should show:
```
memory-daemon          | /call-tool | /health
dynamic-mcp-api-daemon | /call-tool | /health
```

### Step 3: Update Existing External Servers

Check existing servers that need endpoint configuration:

```sql
-- Find servers without endpoint config
SELECT id, name, "transportBaseUrl" 
FROM "MCPServer" 
WHERE "transportType" = 'STREAMABLE_HTTP' 
AND "transportToolEndpoint" IS NULL;
```

For each server, either:

**Option A: Use chat to update:**
```
User: "Update the weather-api server to use default endpoints"
AI: "I've configured the weather-api server with standard endpoints..."
```

**Option B: Update directly in database:**
```sql
UPDATE "MCPServer" 
SET 
  "transportToolEndpoint" = '/call-tool',
  "transportHealthEndpoint" = '/health',
  "transportToolsEndpoint" = '/tools',
  "transportResourcesEndpoint" = '/resources'
WHERE name = 'your-server-name';
```

### Step 4: Test Connections

Restart your services and verify all servers connect properly:

```bash
# Restart services
docker-compose -f docker-compose.dev.yml restart

# Check logs for connection status
docker-compose logs server | grep -E "(✅|❌)"
```

## 🔧 Configuration Options

### Default Behavior (No Changes Needed)

If you don't specify custom endpoints, the system uses defaults:

```javascript
{
  transportToolEndpoint: '/call-tool',      // Default
  transportHealthEndpoint: '/health',       // Default  
  transportToolsEndpoint: '/tools',         // Default
  transportResourcesEndpoint: '/resources'  // Default
}
```

### Custom Endpoint Configuration

For servers with non-standard APIs:

```javascript
// Enterprise API server
{
  name: 'enterprise-api',
  transportBaseUrl: 'https://api.company.com',
  transportToolEndpoint: '/v2/mcp/execute',    // Custom
  transportHealthEndpoint: '/v2/health/check', // Custom
  transportToolsEndpoint: '/v2/mcp/schema',    // Custom
  transportResourcesEndpoint: '/v2/files'      // Custom
}
```

## 🎯 Common Migration Scenarios

### Scenario 1: Standard MCP Server

**Before:**
```javascript
{
  name: 'filesystem',
  transportBaseUrl: 'http://localhost:8080'
  // Endpoints were hardcoded
}
```

**After (automatically migrated):**
```javascript
{
  name: 'filesystem',
  transportBaseUrl: 'http://localhost:8080',
  transportToolEndpoint: '/call-tool',    // Added
  transportHealthEndpoint: '/health',     // Added
  transportToolsEndpoint: '/tools',       // Added
  transportResourcesEndpoint: '/resources' // Added
}
```

### Scenario 2: Custom API Server

**Before:**
```javascript
// Server had non-standard endpoints but system couldn't use them
{
  name: 'weather-api',
  transportBaseUrl: 'https://weather.api.com'
  // System tried /call-tool but server used /execute
}
```

**After:**
```javascript
{
  name: 'weather-api', 
  transportBaseUrl: 'https://weather.api.com',
  transportToolEndpoint: '/execute',       // Now configurable!
  transportHealthEndpoint: '/ping',        // Custom path
  transportToolsEndpoint: '/capabilities', // Custom path
  transportResourcesEndpoint: '/data'      // Custom path
}
```

### Scenario 3: Microservice with Prefix

**Before:**
```javascript
// Had to run proxy to map /call-tool -> /user-service/execute
{
  name: 'user-service',
  transportBaseUrl: 'https://api.company.com'
}
```

**After:**
```javascript
// Direct integration with service prefix
{
  name: 'user-service',
  transportBaseUrl: 'https://api.company.com',
  transportToolEndpoint: '/user-service/execute',
  transportHealthEndpoint: '/user-service/health',
  transportToolsEndpoint: '/user-service/tools',
  transportResourcesEndpoint: '/user-service/files'
}
```

## 🔍 Verification & Testing

### 1. Check Database State

```sql
-- Verify all HTTP servers have endpoint configuration
SELECT 
  name,
  "transportBaseUrl",
  COALESCE("transportToolEndpoint", 'NULL') as tool_endpoint,
  COALESCE("transportHealthEndpoint", 'NULL') as health_endpoint
FROM "MCPServer" 
WHERE "transportType" = 'STREAMABLE_HTTP';
```

### 2. Test Health Checks

```bash
# Test built-in servers
curl http://localhost:3001/health  # memory-daemon
curl http://localhost:3002/health  # api-daemon

# Test custom endpoints (example)
curl https://your-server.com/custom/health
```

### 3. Test Tool Discovery

```bash
# Test built-in servers
curl http://localhost:3001/tools
curl http://localhost:3002/tools

# Test custom endpoints
curl https://your-server.com/custom/capabilities
```

### 4. Monitor Connection Logs

```bash
# Watch for successful connections
docker-compose logs -f server | grep "✅.*is healthy"

# Watch for failed connections  
docker-compose logs -f server | grep "❌.*health check failed"
```

## 🚨 Troubleshooting

### Issue: Server Shows as Disconnected

**Symptoms:**
- Server status shows as "DISCONNECTED" or "ERROR"
- Logs show "health check failed"

**Solution:**
1. Check if server implements the configured endpoint:
   ```bash
   curl https://your-server.com/your-health-endpoint
   ```

2. Update endpoint configuration:
   ```
   User: "Update server-name to use /ping for health checks"
   ```

3. Or fix in database:
   ```sql
   UPDATE "MCPServer" 
   SET "transportHealthEndpoint" = '/ping'
   WHERE name = 'server-name';
   ```

### Issue: Tool Calls Fail

**Symptoms:**
- Health check passes but tool execution fails
- "Unknown tool" or "404 Not Found" errors

**Solution:**
1. Verify tool endpoint configuration:
   ```sql
   SELECT name, "transportToolEndpoint" FROM "MCPServer" WHERE name = 'your-server';
   ```

2. Test tool endpoint manually:
   ```bash
   curl -X POST https://your-server.com/your-tool-endpoint \
     -H "Content-Type: application/json" \
     -d '{"name": "test_tool", "arguments": {}}'
   ```

3. Update configuration if needed:
   ```
   User: "Change server-name to use /api/execute for tool calls"
   ```

### Issue: No Tools Discovered

**Symptoms:**
- Server connects but shows 0 tools
- "📋 Loaded 0 tools from connected server" in logs

**Solution:**
1. Check tools discovery endpoint:
   ```bash
   curl https://your-server.com/your-tools-endpoint
   ```

2. Update tools endpoint:
   ```sql
   UPDATE "MCPServer" 
   SET "transportToolsEndpoint" = '/capabilities'
   WHERE name = 'your-server';
   ```

## 📊 Migration Checklist

- [ ] **Database migration applied** (`npx prisma migrate dev`)
- [ ] **Built-in servers verified** (memory-daemon, api-daemon)
- [ ] **External servers updated** with endpoint configuration
- [ ] **Health checks passing** for all servers
- [ ] **Tool discovery working** (non-zero tool counts)
- [ ] **Tool execution tested** for critical servers
- [ ] **Custom endpoints documented** for team reference
- [ ] **Monitoring updated** for new endpoint paths

## 🎉 Benefits After Migration

### ✅ Universal Compatibility
- Integrate with **any HTTP-based MCP server** regardless of API structure
- No more proxy servers or API adapters needed

### ✅ Better Debugging  
- Clear visibility into which endpoints are being used
- Easier troubleshooting with explicit endpoint configuration

### ✅ Future-Proof Architecture
- Easy to adapt to new MCP server implementations
- Support for evolving API standards and conventions

### ✅ Enhanced Monitoring
- Health checks use the correct endpoint for each server
- Accurate capability discovery from proper endpoints

---

The migration enables your Dynamic MCP system to integrate with virtually any HTTP-based MCP server, making it truly universal! 🌍