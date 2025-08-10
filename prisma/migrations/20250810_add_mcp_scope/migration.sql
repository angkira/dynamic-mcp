-- Add MCPServerScope enum and scope column to MCPServer model (idempotent)

-- Create enum (ignore if exists)
DO $$
BEGIN
  CREATE TYPE "MCPServerScope" AS ENUM ('COMMON','LOCAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add scope column if not exists, default to LOCAL
-- Add scope column with default LOCAL (ignore if already exists)
DO $$
BEGIN
  ALTER TABLE "MCPServer" ADD COLUMN "scope" "MCPServerScope" NOT NULL DEFAULT 'LOCAL';
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Mark core servers as COMMON (no-op if names don't exist)
UPDATE "MCPServer"
SET "scope" = 'COMMON'
WHERE name IN ('dynamic-mcp-api-daemon','memory-daemon');


