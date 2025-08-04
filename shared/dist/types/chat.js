"use strict";
/**
 * Chat-related types and interfaces
 * Shared between client and server
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPAuthType = exports.MCPTransportType = exports.MCPServerStatus = void 0;
/**
 * MCP (Model Context Protocol) related types
 */
var MCPServerStatus;
(function (MCPServerStatus) {
    MCPServerStatus["CONNECTED"] = "CONNECTED";
    MCPServerStatus["DISCONNECTED"] = "DISCONNECTED";
    MCPServerStatus["CONNECTING"] = "CONNECTING";
    MCPServerStatus["ERROR"] = "ERROR";
    MCPServerStatus["UNKNOWN"] = "UNKNOWN";
})(MCPServerStatus || (exports.MCPServerStatus = MCPServerStatus = {}));
var MCPTransportType;
(function (MCPTransportType) {
    MCPTransportType["STDIO"] = "STDIO";
    MCPTransportType["SSE"] = "SSE";
    MCPTransportType["STREAMABLE_HTTP"] = "STREAMABLE_HTTP";
})(MCPTransportType || (exports.MCPTransportType = MCPTransportType = {}));
var MCPAuthType;
(function (MCPAuthType) {
    MCPAuthType["NONE"] = "NONE";
    MCPAuthType["OAUTH"] = "OAUTH";
    MCPAuthType["APIKEY"] = "APIKEY";
    MCPAuthType["BEARER"] = "BEARER";
})(MCPAuthType || (exports.MCPAuthType = MCPAuthType = {}));
//# sourceMappingURL=chat.js.map