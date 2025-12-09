/**
 * API Client Generator
 *
 * Generates TypeScript API clients from OpenAPI/Swagger specifications
 * for all Skillancer microservices.
 *
 * Usage:
 *   pnpm --filter @skillancer/api-client generate
 *   pnpm --filter @skillancer/api-client generate:dev  # With dev URLs
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================

interface ServiceConfig {
  name: string;
  displayName: string;
  devUrl: string;
  prodUrl?: string;
}

const SERVICES: ServiceConfig[] = [
  {
    name: 'auth',
    displayName: 'Auth Service',
    devUrl: 'http://localhost:3001',
    prodUrl: process.env.AUTH_SERVICE_URL,
  },
  {
    name: 'market',
    displayName: 'Market Service',
    devUrl: 'http://localhost:3002',
    prodUrl: process.env.MARKET_SERVICE_URL,
  },
  {
    name: 'skillpod',
    displayName: 'SkillPod Service',
    devUrl: 'http://localhost:3003',
    prodUrl: process.env.SKILLPOD_SERVICE_URL,
  },
  {
    name: 'cockpit',
    displayName: 'Cockpit Service',
    devUrl: 'http://localhost:3004',
    prodUrl: process.env.COCKPIT_SERVICE_URL,
  },
  {
    name: 'billing',
    displayName: 'Billing Service',
    devUrl: 'http://localhost:3005',
    prodUrl: process.env.BILLING_SERVICE_URL,
  },
  {
    name: 'notification',
    displayName: 'Notification Service',
    devUrl: 'http://localhost:3006',
    prodUrl: process.env.NOTIFICATION_SERVICE_URL,
  },
];

const OUTPUT_DIR = path.resolve(__dirname, '../src/generated');

// ============================================================================
// Utilities
// ============================================================================

function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info'): void {
  const prefix = {
    info: '📋',
    success: '✅',
    error: '❌',
    warn: '⚠️',
  }[type];
  console.log(`${prefix} ${message}`);
}

function ensureDirectoryExists(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function fetchOpenApiSpec(url: string): Promise<unknown> {
  const response = await fetch(`${url}/docs/json`);
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenAPI spec from ${url}: ${response.statusText}`);
  }
  return response.json();
}

function writeOpenApiSpec(serviceName: string, spec: unknown): string {
  const specPath = path.join(OUTPUT_DIR, serviceName, 'openapi.json');
  ensureDirectoryExists(path.dirname(specPath));
  fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
  return specPath;
}

function generateClient(serviceName: string, specPath: string): void {
  const outputPath = path.join(OUTPUT_DIR, serviceName);

  execSync(
    `npx openapi-typescript-codegen \
      --input "${specPath}" \
      --output "${outputPath}" \
      --client axios \
      --useOptions \
      --useUnionTypes`,
    { stdio: 'inherit' }
  );
}

// ============================================================================
// Main Generator
// ============================================================================

interface GenerateOptions {
  services?: string[];
  useProdUrls?: boolean;
  skipFetch?: boolean;
}

async function generateApiClients(options: GenerateOptions = {}): Promise<void> {
  const { services: targetServices, useProdUrls = false, skipFetch = false } = options;

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║            🔧 Skillancer API Client Generator                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  ensureDirectoryExists(OUTPUT_DIR);

  const servicesToGenerate = targetServices
    ? SERVICES.filter((s) => targetServices.includes(s.name))
    : SERVICES;

  if (servicesToGenerate.length === 0) {
    log('No services to generate', 'warn');
    return;
  }

  log(`Generating clients for ${servicesToGenerate.length} services...\n`);

  const results: { service: string; success: boolean; error?: string }[] = [];

  for (const service of servicesToGenerate) {
    const url = useProdUrls && service.prodUrl ? service.prodUrl : service.devUrl;

    log(`Processing ${service.displayName} (${url})...`);

    try {
      if (!skipFetch) {
        // Fetch OpenAPI spec from running service
        log(`  Fetching OpenAPI spec...`, 'info');
        const spec = await fetchOpenApiSpec(url);

        // Write spec to file
        const specPath = writeOpenApiSpec(service.name, spec);
        log(`  Saved spec to ${specPath}`, 'success');

        // Generate client
        log(`  Generating TypeScript client...`, 'info');
        generateClient(service.name, specPath);
      } else {
        // Use existing spec file
        const specPath = path.join(OUTPUT_DIR, service.name, 'openapi.json');
        if (!fs.existsSync(specPath)) {
          throw new Error(`No OpenAPI spec found at ${specPath}`);
        }
        generateClient(service.name, specPath);
      }

      log(`  Generated ${service.displayName} client`, 'success');
      results.push({ service: service.name, success: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(`  Failed: ${errorMessage}`, 'error');
      results.push({ service: service.name, success: false, error: errorMessage });
    }

    console.log('');
  }

  // Generate index file
  generateIndexFile(results.filter((r) => r.success).map((r) => r.service));

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                           Summary');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  if (successful.length > 0) {
    log(`Successfully generated: ${successful.map((r) => r.service).join(', ')}`, 'success');
  }

  if (failed.length > 0) {
    log(`Failed: ${failed.map((r) => `${r.service} (${r.error})`).join(', ')}`, 'error');
  }

  console.log(`\n📁 Output directory: ${OUTPUT_DIR}`);
  console.log('\n');
}

function generateIndexFile(services: string[]): void {
  const indexContent = `/**
 * @module @skillancer/api-client/generated
 * Auto-generated API clients
 *
 * Generated on: ${new Date().toISOString()}
 */

${services.map((s) => `export * as ${s}Api from './${s}';`).join('\n')}

// Re-export common types
${services.map((s) => `export type { ApiError as ${capitalize(s)}ApiError } from './${s}';`).join('\n')}
`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.ts'), indexContent);
  log('Generated index.ts', 'success');
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================================
// CLI
// ============================================================================

const args = process.argv.slice(2);
const useProdUrls = args.includes('--prod');
const skipFetch = args.includes('--skip-fetch');
const serviceArgs = args.filter((a) => !a.startsWith('--'));

generateApiClients({
  services: serviceArgs.length > 0 ? serviceArgs : undefined,
  useProdUrls,
  skipFetch,
}).catch((error) => {
  console.error('Generation failed:', error);
  process.exit(1);
});
