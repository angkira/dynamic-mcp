export { }
// Preloadable alias registrar to ensure module-alias is configured BEFORE any imports
// This file is intended to be required with: node -r dist/register-aliases.js
// Do not add any imports that would trigger other module resolutions here.
/* eslint-disable @typescript-eslint/no-var-requires */
const moduleAlias = require('module-alias')
const path = require('node:path')

// At runtime __dirname === /app/dist
const repoRoot = path.join(__dirname, '..') // => /app

moduleAlias.addAliases({
  '@shared/prisma': path.join(repoRoot, 'shared', 'prisma-client'),
  '@shared': path.join(repoRoot, 'shared', 'dist')
})


