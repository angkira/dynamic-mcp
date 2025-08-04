-- CreateEnum
CREATE TYPE "public"."MCPServerStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'CONNECTING', 'ERROR', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "public"."MCPTransportType" AS ENUM ('STDIO', 'SSE', 'STREAMABLE_HTTP');

-- CreateEnum
CREATE TYPE "public"."MCPAuthType" AS ENUM ('NONE', 'OAUTH', 'APIKEY', 'BEARER');

-- CreateTable
CREATE TABLE "public"."MCPServer" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MCPServer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MCPServer_userId_idx" ON "public"."MCPServer"("userId");

-- AddForeignKey
ALTER TABLE "public"."MCPServer" ADD CONSTRAINT "MCPServer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
