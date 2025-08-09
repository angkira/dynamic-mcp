-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."MessageRole" AS ENUM ('USER', 'AI');

-- CreateEnum
CREATE TYPE "public"."MCPServerStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'CONNECTING', 'ERROR', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "public"."MCPTransportType" AS ENUM ('STDIO', 'SSE', 'STREAMABLE_HTTP');

-- CreateEnum
CREATE TYPE "public"."MCPAuthType" AS ENUM ('NONE', 'OAUTH', 'APIKEY', 'BEARER');

-- CreateEnum
CREATE TYPE "public"."MCPServerScope" AS ENUM ('COMMON', 'LOCAL');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Chat" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Message" (
    "id" SERIAL NOT NULL,
    "content" JSONB NOT NULL,
    "role" "public"."MessageRole" NOT NULL DEFAULT 'USER',
    "chatId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "thoughts" JSONB,
    "responseToId" INTEGER,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Settings" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "defaultProvider" TEXT NOT NULL DEFAULT 'google',
    "defaultModel" TEXT NOT NULL DEFAULT 'gemini-2.5-flash-lite',
    "thinkingBudget" INTEGER NOT NULL DEFAULT 2048,
    "responseBudget" INTEGER NOT NULL DEFAULT 8192,
    "openaiApiKey" TEXT,
    "googleApiKey" TEXT,
    "anthropicApiKey" TEXT,
    "deepseekApiKey" TEXT,
    "qwenApiKey" TEXT,
    "mcpEnabledServerIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mcpAutoDiscovery" BOOLEAN NOT NULL DEFAULT true,
    "mcpDefaultTimeout" INTEGER NOT NULL DEFAULT 10000,
    "mcpEnableDebugLogging" BOOLEAN NOT NULL DEFAULT false,
    "mcpMaxConcurrentConnections" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MCPServer" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdBy" INTEGER,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "public"."MCPServerStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "lastConnected" TIMESTAMP(3),
    "transportType" "public"."MCPTransportType" NOT NULL,
    "transportCommand" TEXT,
    "transportArgs" JSONB,
    "transportEnv" JSONB,
    "transportBaseUrl" TEXT,
    "transportTimeout" INTEGER,
    "transportRetryAttempts" INTEGER,
    "transportSessionId" TEXT,
    "authType" "public"."MCPAuthType" NOT NULL DEFAULT 'NONE',
    "authClientId" TEXT,
    "authClientSecret" TEXT,
    "authAuthUrl" TEXT,
    "authTokenUrl" TEXT,
    "authScopes" JSONB,
    "authApiKey" TEXT,
    "authHeaderName" TEXT,
    "authToken" TEXT,
    "configAutoConnect" BOOLEAN NOT NULL DEFAULT false,
    "configConnectionTimeout" INTEGER NOT NULL DEFAULT 10000,
    "configMaxRetries" INTEGER NOT NULL DEFAULT 3,
    "configRetryDelay" INTEGER NOT NULL DEFAULT 2000,
    "configValidateCertificates" BOOLEAN NOT NULL DEFAULT true,
    "configDebug" BOOLEAN NOT NULL DEFAULT false,
    "capabilities" JSONB,
    "scope" "public"."MCPServerScope" NOT NULL DEFAULT 'LOCAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MCPServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Memory" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "key" TEXT,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OAuthAccount" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Message_responseToId_key" ON "public"."Message"("responseToId");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_userId_key" ON "public"."Settings"("userId");

-- CreateIndex
CREATE INDEX "MCPServer_userId_idx" ON "public"."MCPServer"("userId");

-- CreateIndex
CREATE INDEX "Memory_userId_idx" ON "public"."Memory"("userId");

-- CreateIndex
CREATE INDEX "Memory_userId_key_idx" ON "public"."Memory"("userId", "key");

-- CreateIndex
CREATE INDEX "OAuthAccount_userId_idx" ON "public"."OAuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerUserId_key" ON "public"."OAuthAccount"("provider", "providerUserId");

-- AddForeignKey
ALTER TABLE "public"."Chat" ADD CONSTRAINT "Chat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_responseToId_fkey" FOREIGN KEY ("responseToId") REFERENCES "public"."Message"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Settings" ADD CONSTRAINT "Settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MCPServer" ADD CONSTRAINT "MCPServer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Memory" ADD CONSTRAINT "Memory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

