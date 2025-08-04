import { Type, Static } from '@sinclair/typebox'

// Enums
export const MCPServerStatusSchema = Type.Union([
  Type.Literal('CONNECTED'),
  Type.Literal('DISCONNECTED'),
  Type.Literal('CONNECTING'),
  Type.Literal('ERROR'),
  Type.Literal('UNKNOWN')
])

export const MCPTransportTypeSchema = Type.Union([
  Type.Literal('STDIO'),
  Type.Literal('SSE'),
  Type.Literal('STREAMABLE_HTTP')
])

export const MCPAuthTypeSchema = Type.Union([
  Type.Literal('NONE'),
  Type.Literal('OAUTH'),
  Type.Literal('APIKEY'),
  Type.Literal('BEARER')
])

// Tool schema
export const MCPToolSchema = Type.Object({
  name: Type.String(),
  description: Type.String(),
  schema: Type.Record(Type.String(), Type.Unknown()),
  category: Type.Optional(Type.String())
})

// Resource schema
export const MCPResourceSchema = Type.Object({
  uri: Type.String(),
  name: Type.String(),
  description: Type.Optional(Type.String()),
  mimeType: Type.Optional(Type.String()),
  isTemplate: Type.Optional(Type.Boolean())
})

// Prompt argument schema
export const MCPPromptArgumentSchema = Type.Object({
  name: Type.String(),
  description: Type.String(),
  required: Type.Boolean(),
  type: Type.String()
})

// Prompt schema
export const MCPPromptSchema = Type.Object({
  name: Type.String(),
  description: Type.String(),
  arguments: Type.Optional(Type.Array(MCPPromptArgumentSchema))
})

// Capabilities schema
export const MCPCapabilitiesSchema = Type.Object({
  tools: Type.Array(MCPToolSchema, { default: [] }),
  resources: Type.Array(MCPResourceSchema, { default: [] }),
  prompts: Type.Array(MCPPromptSchema, { default: [] }),
  supportsElicitation: Type.Optional(Type.Boolean()),
  supportsRoots: Type.Optional(Type.Boolean()),
  supportsProgress: Type.Optional(Type.Boolean())
})

// Main schemas
export const CreateMCPServerSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  version: Type.String({ minLength: 1 }),
  description: Type.Optional(Type.String()),
  isEnabled: Type.Optional(Type.Boolean({ default: true })),
  
  // Transport configuration
  transportType: MCPTransportTypeSchema,
  transportCommand: Type.Optional(Type.String()),
  transportArgs: Type.Optional(Type.Array(Type.String())),
  transportEnv: Type.Optional(Type.Record(Type.String(), Type.String())),
  transportBaseUrl: Type.Optional(Type.String({ format: 'uri' })),
  transportTimeout: Type.Optional(Type.Integer({ minimum: 1000, maximum: 30000 })),
  transportRetryAttempts: Type.Optional(Type.Integer({ minimum: 0, maximum: 10 })),
  transportSessionId: Type.Optional(Type.String()),
  
  // Authentication configuration
  authType: Type.Optional(MCPAuthTypeSchema),
  authClientId: Type.Optional(Type.String()),
  authClientSecret: Type.Optional(Type.String()),
  authAuthUrl: Type.Optional(Type.String({ format: 'uri' })),
  authTokenUrl: Type.Optional(Type.String({ format: 'uri' })),
  authScopes: Type.Optional(Type.Array(Type.String())),
  authApiKey: Type.Optional(Type.String()),
  authHeaderName: Type.Optional(Type.String()),
  authToken: Type.Optional(Type.String()),
  
  // Server configuration
  configAutoConnect: Type.Optional(Type.Boolean({ default: false })),
  configConnectionTimeout: Type.Optional(Type.Integer({ minimum: 5000, maximum: 60000, default: 10000 })),
  configMaxRetries: Type.Optional(Type.Integer({ minimum: 0, maximum: 10, default: 3 })),
  configRetryDelay: Type.Optional(Type.Integer({ minimum: 1000, maximum: 30000, default: 2000 })),
  configValidateCertificates: Type.Optional(Type.Boolean({ default: true })),
  configDebug: Type.Optional(Type.Boolean({ default: false })),
  
  // Capabilities - can be populated on creation or discovered later
  capabilities: Type.Optional(MCPCapabilitiesSchema)
})

export const MCPServerParamsSchema = Type.Object({
  id: Type.String(),
});

export const UpdateMCPServerSchema = Type.Partial(CreateMCPServerSchema)

export const UpdateMCPServerStatusSchema = Type.Object({
  status: MCPServerStatusSchema,
  lastConnected: Type.Optional(Type.String({ format: 'date-time' }))
})

// Response schemas
export const MCPServerResponseSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  version: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  isEnabled: Type.Boolean(),
  status: Type.String(),
  lastConnected: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  transport: Type.Object({
    type: Type.String(),
    config: Type.Object({
      command: Type.Union([Type.String(), Type.Null()]),
      args: Type.Array(Type.String()),
      env: Type.Record(Type.String(), Type.String()),
      baseUrl: Type.Union([Type.String(), Type.Null()]),
      timeout: Type.Union([Type.Integer(), Type.Null()]),
      retryAttempts: Type.Union([Type.Integer(), Type.Null()]),
      sessionId: Type.Union([Type.String(), Type.Null()])
    })
  }),
  authentication: Type.Object({
    type: Type.String(),
    config: Type.Object({
      clientId: Type.Union([Type.String(), Type.Null()]),
      clientSecret: Type.Union([Type.String(), Type.Null()]),
      authUrl: Type.Union([Type.String(), Type.Null()]),
      tokenUrl: Type.Union([Type.String(), Type.Null()]),
      scopes: Type.Array(Type.String()),
      apiKey: Type.Union([Type.String(), Type.Null()]),
      headerName: Type.Union([Type.String(), Type.Null()]),
      token: Type.Union([Type.String(), Type.Null()])
    })
  }),
  config: Type.Object({
    autoConnect: Type.Boolean(),
    connectionTimeout: Type.Integer(),
    maxRetries: Type.Integer(),
    retryDelay: Type.Integer(),
    validateCertificates: Type.Boolean(),
    debug: Type.Boolean()
  }),
  capabilities: Type.Union([MCPCapabilitiesSchema, Type.Object({})])
})

export const ApiResponseSchema = (dataSchema?: any) => Type.Object({
  success: Type.Boolean(),
  data: dataSchema ? Type.Union([dataSchema, Type.Null()]) : Type.Optional(Type.Unknown()),
  message: Type.Optional(Type.String()),
  errors: Type.Optional(Type.Array(Type.Unknown()))
})

// Type exports for TypeScript
export type CreateMCPServerType = Static<typeof CreateMCPServerSchema>
export type UpdateMCPServerType = Static<typeof UpdateMCPServerSchema>
export type UpdateMCPServerStatusType = Static<typeof UpdateMCPServerStatusSchema>
export type MCPServerParamsType = Static<typeof MCPServerParamsSchema>
export type MCPServerResponseType = Static<typeof MCPServerResponseSchema>
export type MCPCapabilitiesType = Static<typeof MCPCapabilitiesSchema>
export type MCPToolType = Static<typeof MCPToolSchema>
export type MCPResourceType = Static<typeof MCPResourceSchema>
export type MCPPromptType = Static<typeof MCPPromptSchema>