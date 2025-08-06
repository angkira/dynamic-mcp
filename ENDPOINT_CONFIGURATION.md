# HTTP Endpoint Configuration Guide

Dynamic MCP now supports **full customization of HTTP endpoint paths** for MCP servers, giving you complete control over how your servers expose their APIs.

## 🎯 Overview

Instead of being locked into standard paths like `/call-tool` and `/health`, you can now configure:

- **Tool Call Endpoints**: `/call-tool`, `/execute`, `/api/tools/run`, etc.
- **Health Check Endpoints**: `/health`, `/status`, `/ping`, `/api/health`, etc.  
- **Tool Discovery Endpoints**: `/tools`, `/capabilities`, `/api/schema`, etc.
- **Resource Endpoints**: `/resources`, `/files`, `/api/resources`, etc.

## 🔧 Configuration Methods

### 1. Through Chat Interface (Recommended)

**Register with custom endpoints:**
```
User: "Add a weather server at https://api.weather.com with these endpoints:
- Tool calls: /api/execute  
- Health checks: /status
- Tool discovery: /capabilities
- Resources: /data"

AI: "Setting up weather server with custom endpoint configuration..."
```

**Update existing server:**
```
User: "Change the weather server to use /ping for health checks instead of /status"

AI: "Updated weather server health endpoint to /ping"
```

### 2. Through Web UI

1. Navigate to **Settings > MCP Servers**
2. Click **"Add Server"** or edit existing server
3. Select **"Streamable HTTP"** transport type
4. Configure endpoint fields:

![MCP Settings UI](docs/images/mcp-endpoint-config.png)

- **Base URL**: `https://your-server.com`
- **Tool Call Endpoint**: `/api/execute` 
- **Health Check Endpoint**: `/status`
- **Tools Discovery Endpoint**: `/capabilities`
- **Resources Endpoint**: `/data`

### 3. Direct API Calls

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "custom-server",
    "transportType": "STREAMABLE_HTTP",
    "transportBaseUrl": "https://api.example.com",
    "transportToolEndpoint": "/api/execute",
    "transportHealthEndpoint": "/status", 
    "transportToolsEndpoint": "/capabilities",
    "transportResourcesEndpoint": "/data"
  }'
```

## 🏗️ Database Schema

The endpoint configuration is stored in the `MCPServer` table:

```sql
CREATE TABLE "MCPServer" (
  -- ... other fields ...
  "transportBaseUrl"           String?,
  "transportToolEndpoint"      String? DEFAULT '/call-tool',
  "transportHealthEndpoint"    String? DEFAULT '/health',
  "transportToolsEndpoint"     String? DEFAULT '/tools', 
  "transportResourcesEndpoint" String? DEFAULT '/resources'
);
```

## 🔄 System Behavior

### Health Checking

The system uses your configured health endpoint:

```typescript
// Before (hardcoded)
const healthUrl = `${baseUrl}/health`

// After (configurable)  
const healthEndpoint = server.transportHealthEndpoint || '/health'
const healthUrl = `${baseUrl}${healthEndpoint}`
```

### Tool Execution

Tool calls use your configured tool endpoint:

```typescript
// Before (hardcoded)
const toolUrl = `${baseUrl}/call-tool`

// After (configurable)
const toolEndpoint = server.transportToolEndpoint || '/call-tool'  
const toolUrl = `${baseUrl}${toolEndpoint}`
```

### Capability Discovery

Tool discovery uses your configured tools endpoint:

```typescript
// Before (hardcoded)
const toolsUrl = `${baseUrl}/tools`

// After (configurable)
const toolsEndpoint = server.transportToolsEndpoint || '/tools'
const toolsUrl = `${baseUrl}${toolsEndpoint}`
```

## 🌟 Real-World Examples

### Enterprise API Server

```javascript
{
  "name": "enterprise-api",
  "transportBaseUrl": "https://api.company.com",
  "transportToolEndpoint": "/v2/mcp/execute",
  "transportHealthEndpoint": "/v2/health/check", 
  "transportToolsEndpoint": "/v2/mcp/schema",
  "transportResourcesEndpoint": "/v2/mcp/resources"
}
```

### Microservice with Prefix

```javascript
{
  "name": "user-service",
  "transportBaseUrl": "https://microservices.company.com",
  "transportToolEndpoint": "/user-service/execute",
  "transportHealthEndpoint": "/user-service/health",
  "transportToolsEndpoint": "/user-service/tools", 
  "transportResourcesEndpoint": "/user-service/resources"
}
```

### Legacy System Integration

```javascript
{
  "name": "legacy-integration", 
  "transportBaseUrl": "https://legacy.company.com",
  "transportToolEndpoint": "/legacy/api/call",
  "transportHealthEndpoint": "/legacy/ping",
  "transportToolsEndpoint": "/legacy/api/methods",
  "transportResourcesEndpoint": "/legacy/api/files"
}
```

### Development Server

```javascript
{
  "name": "dev-filesystem",
  "transportBaseUrl": "http://localhost:8080", 
  "transportToolEndpoint": "/fs/execute",
  "transportHealthEndpoint": "/fs/status",
  "transportToolsEndpoint": "/fs/capabilities",
  "transportResourcesEndpoint": "/fs/browse"
}
```

## 🔍 Monitoring & Debugging

### Check Current Configuration

```sql
-- View all server endpoints
SELECT 
  name,
  "transportBaseUrl",
  "transportToolEndpoint", 
  "transportHealthEndpoint",
  "transportToolsEndpoint",
  "transportResourcesEndpoint"
FROM "MCPServer" 
WHERE "transportType" = 'STREAMABLE_HTTP';
```

### Test Custom Endpoints

```bash
# Health check with custom endpoint
curl https://api.example.com/custom/health

# Tool discovery with custom endpoint  
curl https://api.example.com/custom/capabilities

# Tool execution with custom endpoint
curl -X POST https://api.example.com/custom/execute \
  -H "Content-Type: application/json" \
  -d '{"name": "tool_name", "arguments": {}}'
```

### Debug Connection Issues

1. **Check endpoint URLs** in database
2. **Verify server responses** at custom paths
3. **Check logs** for endpoint resolution:

```bash
docker-compose logs server | grep "Testing HTTP daemon health"
```

## 🚀 Migration Guide

### From Hardcoded to Configurable

If you have existing MCP servers that were set up before endpoint configuration:

1. **Check current servers:**
   ```sql
   SELECT name, "transportBaseUrl" FROM "MCPServer" 
   WHERE "transportToolEndpoint" IS NULL;
   ```

2. **Update via chat:**
   ```
   User: "Update the weather-api server to use /v2/execute for tool calls"
   ```

3. **Or update directly:**
   ```sql
   UPDATE "MCPServer" 
   SET "transportToolEndpoint" = '/v2/execute'
   WHERE name = 'weather-api';
   ```

### Built-in Server Migration

Built-in servers (memory-daemon, dynamic-mcp-api-daemon) now have explicit endpoint configuration in `fill.sql`:

```sql
INSERT INTO "MCPServer" (
  -- ... other fields ...
  "transportToolEndpoint",
  "transportHealthEndpoint", 
  "transportToolsEndpoint",
  "transportResourcesEndpoint"
) VALUES (
  -- ... other values ...
  '/call-tool',
  '/health',
  '/tools', 
  '/resources'
);
```

## 🎯 Best Practices

### Endpoint Naming

- **Use consistent prefixes**: `/api/v1/execute`, `/api/v1/health`
- **Follow REST conventions**: `/tools` for GET, `/call-tool` for POST
- **Include version info**: `/v2/health`, `/v3/execute`
- **Use descriptive paths**: `/capabilities` vs `/tools`

### Security Considerations

- **Validate endpoint paths** before storing
- **Sanitize user input** for endpoint configuration  
- **Use HTTPS** for all external endpoints
- **Implement rate limiting** per endpoint

### Performance Tips

- **Cache endpoint URLs** after resolution
- **Use health check intervals** appropriate for endpoint response time
- **Monitor endpoint latency** and adjust timeouts
- **Consider endpoint-specific retry logic**

## 🔧 Troubleshooting

### Common Issues

**Endpoint not found (404):**
- Verify endpoint path is correct
- Check if server implements the endpoint
- Ensure base URL is accessible

**Connection timeouts:**
- Check if custom endpoints have different response times
- Adjust `transportTimeout` for slower endpoints
- Verify network connectivity to custom paths

**Tool execution failures:**
- Confirm tool endpoint accepts POST requests
- Verify request format matches server expectations  
- Check authentication headers are passed correctly

**Health check failures:**
- Ensure health endpoint returns 200 status
- Check if endpoint requires specific headers
- Verify endpoint doesn't require authentication

### Debug Commands

```bash
# Test all endpoints for a server
for endpoint in health tools call-tool resources; do
  echo "Testing $endpoint..."
  curl -f "https://api.example.com/custom/$endpoint" || echo "Failed"
done

# Check database configuration
docker-compose exec db psql -U postgres -d agentdb -c \
  "SELECT name, \"transportToolEndpoint\" FROM \"MCPServer\";"

# Monitor connection attempts  
docker-compose logs -f server | grep "HTTP daemon health"
```

---

The endpoint configuration feature makes Dynamic MCP truly universal - it can now integrate with any HTTP-based MCP server regardless of their API structure! 🎉