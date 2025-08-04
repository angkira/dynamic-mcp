-- AlterTable
ALTER TABLE "public"."Settings" ADD COLUMN     "mcpAutoDiscovery" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "mcpDefaultTimeout" INTEGER NOT NULL DEFAULT 10000,
ADD COLUMN     "mcpEnableDebugLogging" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mcpMaxConcurrentConnections" INTEGER NOT NULL DEFAULT 5;
