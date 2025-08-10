DO 246380
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'mcpserverscope'
  ) THEN
    CREATE TYPE "MCPServerScope" AS ENUM ('COMMON','LOCAL');
  END IF;
END 246380;

DO 246380
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'MCPServer' AND column_name = 'scope'
  ) THEN
    ALTER TABLE "MCPServer" ADD COLUMN "scope" "MCPServerScope" NOT NULL DEFAULT 'LOCAL';
  END IF;
END 246380;

UPDATE "MCPServer"
SET "scope" = 'COMMON'
WHERE name IN ('dynamic-mcp-api-daemon','memory-daemon');
