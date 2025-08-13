// Type shim to make TypeScript resolve the Prisma client from shared during build
// Path from server/src/types → repo root shared/prisma
declare module '@shared/prisma' {
  export {
    PrismaClient,
    Prisma,
    Settings,
    MCPServer,
    MCPServerStatus,
    MCPTransportType,
    MCPAuthType
  } from '../../../shared/prisma';
}


