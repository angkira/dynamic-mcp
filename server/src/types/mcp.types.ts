import type { MCPServerStatus, Prisma } from '@prisma/client';

export interface MCPToolForLLM {
  name: string;
  description: string;
  parameters?: Record<string, unknown>; // Legacy format
  inputSchema?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
    [key: string]: any;
  }; // New JSON Schema format
  metadata: {
    serverId: number;
    serverName: string;
    originalName: string;
    transportType?: string;
    transportCommand?: string;
  };
}

export interface MCPResourceForLLM {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
  serverName: string;
  serverId: number;
}

export interface MCPConnectionInfo {
  serverId: number;
  serverName: string;
  isConnected: boolean;
  lastConnected: Date;
}

export interface MCPHealthCheckResult {
  serverId: number;
  serverName: string;
  healthy: boolean;
  error?: string;
}

export interface CallToolResult {
  stdout: string;
  stderr: string;
  [key: string]: any;
}

export interface ReadResourceResult {
  content: string;
  mimeType?: string;
  [key: string]: any;
}

export interface GetPromptResult {
  content: string;
  [key: string]: any;
}

export interface MCPServerUpdateData {
  name?: string;
  version?: string;
  description?: string | null;
  isEnabled?: boolean;
  transportType?: string;
  transportCommand?: string | null;
  transportArgs?: Prisma.JsonValue;
  transportEnv?: Prisma.JsonValue;
  transportBaseUrl?: string | null;
  transportTimeout?: number | null;
  transportRetryAttempts?: number | null;
  transportSessionId?: string | null;
  authType?: string;
  authClientId?: string | null;
  authClientSecret?: string | null;
  authAuthUrl?: string | null;
  authTokenUrl?: string | null;
  authScopes?: Prisma.JsonValue;
  authApiKey?: string | null;
  authHeaderName?: string | null;
  authToken?: string | null;
  configAutoConnect?: boolean;
  configConnectionTimeout?: number;
  configMaxRetries?: number;
  configRetryDelay?: number;
  configValidateCertificates?: boolean;
  configDebug?: boolean;
  capabilities?: Prisma.JsonValue;
}

export interface MCPServerStatusUpdateData {
  status: MCPServerStatus;
  lastConnected?: Date;
}

export interface MCPCapabilities {
  tools: any[];
  resources: any[];
  prompts: any[];
}
