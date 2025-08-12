// Ensure module aliases work when running compiled MCP servers in containers
// without relying solely on package.json discovery.
// Use var to avoid TS "redeclare" collisions when multiple bootstrap files coexist
// eslint-disable-next-line @typescript-eslint/no-explicit-any
var moduleAlias: any = require('module-alias');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
var path: any = require('node:path');

var repoRoot = path.join(process.cwd(), '..'); // /app/server -> /app
moduleAlias.addAliases({
  '@shared-prisma': path.join(repoRoot, 'shared', 'prisma-client'),
  '@shared': path.join(repoRoot, 'shared', 'dist')
});


