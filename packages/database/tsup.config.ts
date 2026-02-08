import { defineConfig } from 'tsup';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Check if Prisma client types are generated
const prismaClientPath = resolve(__dirname, 'node_modules/.prisma/client/index.d.ts');
const hasPrismaTypes = existsSync(prismaClientPath);

export default defineConfig({
  entry: ['src/index.ts', 'src/client.ts', 'src/extensions/index.ts'],
  format: ['cjs', 'esm'],
  // Only generate DTS if Prisma types are available
  dts: hasPrismaTypes,
  splitting: false,
  sourcemap: true,
  clean: true,
  // Keep @prisma/client external — Node.js CJS interop handles ESM imports from CJS.
  // Bundling it causes "Dynamic require of .prisma/client/default is not supported".
  external: ['@prisma/client', '.prisma/client', '.prisma/client/default'],
  treeshake: true,
  onSuccess: hasPrismaTypes
    ? undefined
    : async () => {
        console.warn(
          '\n⚠️  DTS generation skipped - Prisma client not generated (run pnpm db:generate with network access)\n'
        );
      },
});
