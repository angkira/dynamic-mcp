-- Database initialization script for Docker containers
-- This script creates all tables and inserts default data

-- Create enum types
CREATE TYPE "public"."MessageRole" AS ENUM ('USER', 'AI');
CREATE TYPE "public"."MCPServerStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'CONNECTING', 'ERROR', 'UNKNOWN');
CREATE TYPE "public"."MCPTransportType" AS ENUM ('STDIO', 'SSE', 'STREAMABLE_HTTP');
CREATE TYPE "public"."MCPAuthType" AS ENUM ('NONE', 'OAUTH', 'APIKEY', 'BEARER');

-- Create User table
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Create Chat table
CREATE TABLE "public"."Chat" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- Create Message table
CREATE TABLE "public"."Message" (
    "id" SERIAL NOT NULL,
    "content" JSONB NOT NULL,
    "thoughts" JSONB,
    "role" "public"."MessageRole" NOT NULL DEFAULT 'USER',
    "chatId" INTEGER NOT NULL,
    "responseToId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- Create Settings table
CREATE TABLE "public"."Settings" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "defaultProvider" TEXT NOT NULL DEFAULT 'openai',
    "defaultModel" TEXT NOT NULL DEFAULT 'o3-mini',
    "thinkingBudget" INTEGER NOT NULL DEFAULT 2048,
    "responseBudget" INTEGER NOT NULL DEFAULT 8192,
    "mcpEnableDebugLogging" BOOLEAN NOT NULL DEFAULT false,
    "mcpDefaultTimeout" INTEGER NOT NULL DEFAULT 10000,
    "mcpMaxConcurrentConnections" INTEGER NOT NULL DEFAULT 5,
    "mcpAutoDiscovery" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- Create MCPServer table
CREATE TABLE "public"."MCPServer" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "public"."MCPServerStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "lastConnected" TIMESTAMP(3),
    
    -- Transport configuration
    "transportType" "public"."MCPTransportType" NOT NULL,
    "transportCommand" TEXT,
    "transportArgs" JSONB,
    "transportEnv" JSONB,
    "transportBaseUrl" TEXT,
    "transportTimeout" INTEGER,
    "transportRetryAttempts" INTEGER,
    "transportSessionId" TEXT,
    
    -- Authentication configuration
    "authType" "public"."MCPAuthType" NOT NULL DEFAULT 'NONE',
    "authClientId" TEXT,
    "authClientSecret" TEXT,
    "authAuthUrl" TEXT,
    "authTokenUrl" TEXT,
    "authScopes" JSONB,
    "authApiKey" TEXT,
    "authHeaderName" TEXT,
    "authToken" TEXT,
    
    -- Server configuration
    "configAutoConnect" BOOLEAN NOT NULL DEFAULT false,
    "configConnectionTimeout" INTEGER NOT NULL DEFAULT 10000,
    "configMaxRetries" INTEGER NOT NULL DEFAULT 3,
    "configRetryDelay" INTEGER NOT NULL DEFAULT 2000,
    "configValidateCertificates" BOOLEAN NOT NULL DEFAULT true,
    "configDebug" BOOLEAN NOT NULL DEFAULT false,
    
    -- Capabilities
    "capabilities" JSONB,
    
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MCPServer_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");
CREATE UNIQUE INDEX "Settings_userId_key" ON "public"."Settings"("userId");
CREATE INDEX "MCPServer_userId_idx" ON "public"."MCPServer"("userId");

-- Add foreign key constraints
ALTER TABLE "public"."Chat" ADD CONSTRAINT "Chat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_responseToId_fkey" FOREIGN KEY ("responseToId") REFERENCES "public"."Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Settings" ADD CONSTRAINT "Settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."MCPServer" ADD CONSTRAINT "MCPServer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Insert default data
-- Create default user
INSERT INTO "public"."User" (email, name) 
VALUES ('user@example.com', 'Default User')
ON CONFLICT (email) DO NOTHING;

-- Create default settings for the user
INSERT INTO "public"."Settings" (
  "userId", 
  "defaultProvider", 
  "defaultModel", 
  "thinkingBudget", 
  "responseBudget",
  "mcpEnableDebugLogging",
  "mcpDefaultTimeout",
  "mcpMaxConcurrentConnections",
  "mcpAutoDiscovery"
)
SELECT 
  u.id,
  'openai',
  'o3-mini',
  2048,
  8192,
  false,
  10000,
  5,
  true
FROM "public"."User" u 
WHERE u.email = 'user@example.com'
AND NOT EXISTS (SELECT 1 FROM "public"."Settings" s WHERE s."userId" = u.id);