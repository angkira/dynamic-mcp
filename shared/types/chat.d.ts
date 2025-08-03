/**
 * Chat-related types and interfaces
 * Shared between client and server
 */
/**
 * Chat interface aligned with database schema
 */
export interface Chat {
    id: number;
    title: string | null;
    userId: number;
    createdAt: string;
    updatedAt: string;
    lastMessage?: string;
    lastMessageAt?: string;
}
/**
 * User interface for authentication and chat ownership
 */
export interface User {
    id: number;
    email: string;
    name: string | null;
    createdAt: string;
    updatedAt: string;
}
/**
 * User settings interface aligned with database schema
 */
export interface Settings {
    id: number;
    userId: number;
    defaultProvider: string;
    defaultModel: string;
    thinkingBudget: number;
    responseBudget: number;
    createdAt: string;
    updatedAt: string;
}
/**
 * MCP (Model Context Protocol) related types
 */
export declare enum MCPServerStatus {
    CONNECTED = "CONNECTED",
    DISCONNECTED = "DISCONNECTED",
    CONNECTING = "CONNECTING",
    ERROR = "ERROR",
    UNKNOWN = "UNKNOWN"
}
export declare enum MCPTransportType {
    STDIO = "STDIO",
    SSE = "SSE",
    STREAMABLE_HTTP = "STREAMABLE_HTTP"
}
export declare enum MCPAuthType {
    NONE = "NONE",
    OAUTH = "OAUTH",
    APIKEY = "APIKEY",
    BEARER = "BEARER"
}
export interface MCPServer {
    id: number;
    userId: number;
    name: string;
    description: string | null;
    command: string;
    args: any;
    cwd: string | null;
    env: any;
    status: MCPServerStatus;
    transportType: MCPTransportType;
    authType: MCPAuthType;
    authConfig: any;
    createdAt: string;
    updatedAt: string;
}
//# sourceMappingURL=chat.d.ts.map