// Ensure module aliases work when running compiled MCP servers in containers
// without relying solely on package.json discovery.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const moduleAlias = require('module-alias') as typeof import('module-alias');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('node:path');

const repoRoot = path.join(process.cwd(), '..'); // /app/server -> /app
moduleAlias.addAliases({
  '@shared-prisma': path.join(repoRoot, 'shared', 'prisma-client'),
  '@shared': path.join(repoRoot, 'shared', 'dist')
});


