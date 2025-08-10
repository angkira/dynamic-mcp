-- Add MCPServerScope enum and scope column to MCPServer model (idempotent)

DO $$
BEGIN
  -- Create enum if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'mcpserverscope'
  ) THEN
    CREATE TYPE "MCPServerScope" AS ENUM ('COMMON','LOCAL');
  END IF;
END $$;

-- Add scope column if not exists, default to LOCAL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'MCPServer' AND column_name = 'scope'
  ) THEN
    ALTER TABLE "MCPServer" ADD COLUMN "scope" "MCPServerScope" NOT NULL DEFAULT 'LOCAL';
  END IF;
END $$;

-- Mark core servers as COMMON (no-op if names don't exist)
UPDATE "MCPServer"
SET "scope" = 'COMMON'
WHERE name IN ('dynamic-mcp-api-daemon','memory-daemon');


