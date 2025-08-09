import './bootstrap'

async function main() {
  const mode = (process.env.MCP_SERVER || '').toLowerCase()
  if (mode === 'memory') {
    await import('./memory-server')
    return
  }
  if (mode === 'api') {
    await import('./dynamic-mcp-api-server')
    return
  }
  // Fallback: run both in sequence? Safer to require explicit mode
  console.error('MCP_SERVER not set or invalid. Set MCP_SERVER=memory or MCP_SERVER=api')
  process.exit(1)
}

main().catch((err) => {
  console.error('MCP entry failed:', err)
  process.exit(1)
})


