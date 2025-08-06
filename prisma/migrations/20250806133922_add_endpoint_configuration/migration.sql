-- AlterTable
ALTER TABLE "public"."MCPServer" ADD COLUMN     "transportHealthEndpoint" TEXT DEFAULT '/health',
ADD COLUMN     "transportResourcesEndpoint" TEXT DEFAULT '/resources',
ADD COLUMN     "transportToolEndpoint" TEXT DEFAULT '/call-tool',
ADD COLUMN     "transportToolsEndpoint" TEXT DEFAULT '/tools';
