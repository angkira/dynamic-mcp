// Type shim to make TypeScript resolve the Prisma client from shared during build
declare module '@shared-prisma' {
  export * from '../../shared/prisma-client';
}


