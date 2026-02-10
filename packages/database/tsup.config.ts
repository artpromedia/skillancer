import { defineConfig } from 'tsup';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Check if Prisma client types are generated
const prismaClientPath = resolve(__dirname, 'node_modules/.prisma/client/index.d.ts');
const hasPrismaTypes = existsSync(prismaClientPath);

export default defineConfig({
  entry: ['src/index.ts', 'src/client.ts', 'src/extensions/index.ts'],
  // CJS only — @prisma/client v5 is CJS-only and cannot be re-exported via ESM
  // named exports in Node.js. Services with "type": "module" can still import CJS.
  format: ['cjs'],
  // Only generate DTS if Prisma types are available
  dts: hasPrismaTypes,
  splitting: false,
  sourcemap: true,
  clean: true,
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
