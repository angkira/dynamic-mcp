declare module 'module-alias' {
  export function addAlias(fromPath: string, toPath: string): void
  export function addAliases(aliases: Record<string, string>): void
}


