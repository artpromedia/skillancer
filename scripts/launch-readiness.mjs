#!/usr/bin/env node

/**
 * Launch Readiness Check Script
 *
 * Validates that all systems are ready for production launch.
 * Run this before deploying to production.
 *
 * Usage:
 *   node scripts/launch-readiness.mjs
 *   pnpm launch:check
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// =============================================================================
// CONFIGURATION
// =============================================================================

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'SESSION_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'REDIS_URL',
];

const RECOMMENDED_ENV_VARS = ['SENTRY_DSN', 'SMTP_HOST', 'AWS_REGION', 'S3_BUCKET'];

const REQUIRED_FILES = ['package.json', 'pnpm-workspace.yaml', 'turbo.json', 'docker-compose.yml'];

const SERVICES = [
  'api-gateway',
  'auth-svc',
  'billing-svc',
  'notification-svc',
  'market-svc',
  'skillpod-svc',
];

// =============================================================================
// UTILITIES
// =============================================================================

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = '') {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('');
  log(`━━━ ${title} ━━━`, colors.cyan + colors.bold);
}

function logSuccess(message) {
  log(`  ✅ ${message}`, colors.green);
}

function logWarning(message) {
  log(`  ⚠️  ${message}`, colors.yellow);
}

function logError(message) {
  log(`  ❌ ${message}`, colors.red);
}

function logInfo(message) {
  log(`  ℹ️  ${message}`, colors.blue);
}

// =============================================================================
// CHECKS
// =============================================================================

const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  errors: [],
  warnings: [],
};

/**
 * Check required files exist
 */
function checkRequiredFiles() {
  logSection('Required Files');

  for (const file of REQUIRED_FILES) {
    if (existsSync(file)) {
      logSuccess(`${file} exists`);
      results.passed++;
    } else {
      logError(`${file} is missing`);
      results.failed++;
      results.errors.push(`Missing file: ${file}`);
    }
  }
}

/**
 * Check environment variables
 */
function checkEnvironment() {
  logSection('Environment Variables');

  // Check required vars
  for (const envVar of REQUIRED_ENV_VARS) {
    if (process.env[envVar]) {
      logSuccess(`${envVar} is set`);
      results.passed++;
    } else {
      logError(`${envVar} is NOT set (required)`);
      results.failed++;
      results.errors.push(`Missing required env var: ${envVar}`);
    }
  }

  // Check recommended vars
  for (const envVar of RECOMMENDED_ENV_VARS) {
    if (process.env[envVar]) {
      logSuccess(`${envVar} is set`);
      results.passed++;
    } else {
      logWarning(`${envVar} is not set (recommended)`);
      results.warnings++;
    }
  }
}

/**
 * Check package.json configuration
 */
function checkPackageJson() {
  logSection('Package Configuration');

  try {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));

    // Check version
    if (pkg.version && pkg.version !== '0.0.0') {
      logSuccess(`Version: ${pkg.version}`);
      results.passed++;
    } else {
      logWarning('Version should be set before launch');
      results.warnings++;
    }

    // Check scripts
    const requiredScripts = ['build', 'start', 'test', 'lint'];
    for (const script of requiredScripts) {
      if (pkg.scripts?.[script]) {
        logSuccess(`Script "${script}" defined`);
        results.passed++;
      } else {
        logError(`Script "${script}" is missing`);
        results.failed++;
        results.errors.push(`Missing script: ${script}`);
      }
    }
  } catch (error) {
    logError(`Failed to read package.json: ${error.message}`);
    results.failed++;
  }
}

/**
 * Check services exist
 */
function checkServices() {
  logSection('Services');

  for (const service of SERVICES) {
    const servicePath = join('services', service);
    const pkgPath = join(servicePath, 'package.json');

    if (existsSync(pkgPath)) {
      logSuccess(`${service} exists`);
      results.passed++;

      // Check service has required files
      const srcPath = join(servicePath, 'src');
      const hasIndex = existsSync(join(servicePath, 'src', 'index.ts'));
      if (!hasIndex) {
        logWarning(`${service} missing src/index.ts`);
        results.warnings++;
      }
    } else {
      logError(`${service} is missing`);
      results.failed++;
      results.errors.push(`Missing service: ${service}`);
    }
  }
}

/**
 * Check TypeScript configuration
 */
function checkTypeScript() {
  logSection('TypeScript');

  try {
    log('  Running type check...', colors.blue);
    execSync('pnpm typecheck', { stdio: 'pipe' });
    logSuccess('TypeScript compilation successful');
    results.passed++;
  } catch (error) {
    logError('TypeScript compilation failed');
    results.failed++;
    results.errors.push('TypeScript errors found - run pnpm typecheck');
  }
}

/**
 * Check tests pass
 */
function checkTests() {
  logSection('Tests');

  try {
    log('  Running tests...', colors.blue);
    execSync('pnpm test', { stdio: 'pipe', timeout: 300000 });
    logSuccess('All tests passed');
    results.passed++;
  } catch (error) {
    logWarning('Some tests failed');
    results.warnings++;
  }
}

/**
 * Check linting
 */
function checkLinting() {
  logSection('Linting');

  try {
    log('  Running linter...', colors.blue);
    execSync('pnpm lint', { stdio: 'pipe' });
    logSuccess('No linting errors');
    results.passed++;
  } catch (error) {
    logWarning('Linting issues found');
    results.warnings++;
  }
}

/**
 * Check build succeeds
 */
function checkBuild() {
  logSection('Build');

  try {
    log('  Building all packages...', colors.blue);
    execSync('pnpm build', { stdio: 'pipe', timeout: 600000 });
    logSuccess('Build completed successfully');
    results.passed++;
  } catch (error) {
    logError('Build failed');
    results.failed++;
    results.errors.push('Build failed - run pnpm build');
  }
}

/**
 * Check database migrations
 */
function checkDatabase() {
  logSection('Database');

  if (!process.env.DATABASE_URL) {
    logWarning('DATABASE_URL not set - skipping database checks');
    results.warnings++;
    return;
  }

  try {
    log('  Checking migration status...', colors.blue);
    const status = execSync('pnpm db:migrate:status', { stdio: 'pipe' }).toString();

    if (status.includes('pending')) {
      logWarning('Pending migrations found');
      results.warnings++;
    } else {
      logSuccess('All migrations applied');
      results.passed++;
    }
  } catch (error) {
    logWarning('Could not check migration status');
    results.warnings++;
  }
}

/**
 * Check Docker configuration
 */
function checkDocker() {
  logSection('Docker');

  // Check docker-compose.yml exists
  if (existsSync('docker-compose.yml')) {
    logSuccess('docker-compose.yml exists');
    results.passed++;
  } else {
    logError('docker-compose.yml is missing');
    results.failed++;
  }

  // Check Dockerfiles exist for services
  for (const service of SERVICES) {
    const dockerfilePath = join('services', service, 'Dockerfile');
    if (existsSync(dockerfilePath)) {
      logSuccess(`${service}/Dockerfile exists`);
      results.passed++;
    } else {
      logWarning(`${service}/Dockerfile is missing`);
      results.warnings++;
    }
  }
}

/**
 * Check security configuration
 */
function checkSecurity() {
  logSection('Security');

  // Check JWT secret strength
  const jwtSecret = process.env.JWT_SECRET || '';
  if (jwtSecret.length >= 32) {
    logSuccess('JWT_SECRET is sufficiently long');
    results.passed++;
  } else if (jwtSecret) {
    logWarning('JWT_SECRET should be at least 32 characters');
    results.warnings++;
  }

  // Check for development secrets in production
  if (process.env.NODE_ENV === 'production') {
    const devSecrets = ['secret', 'password', 'test', 'dev', 'development'];
    for (const envVar of REQUIRED_ENV_VARS) {
      const value = (process.env[envVar] || '').toLowerCase();
      for (const devSecret of devSecrets) {
        if (value.includes(devSecret)) {
          logError(`${envVar} contains development-like value`);
          results.failed++;
          results.errors.push(`${envVar} may contain test credentials`);
          break;
        }
      }
    }
  }

  // Check CORS configuration
  if (process.env.CORS_ORIGINS) {
    if (process.env.CORS_ORIGINS.includes('*')) {
      logWarning('CORS allows all origins - review for production');
      results.warnings++;
    } else {
      logSuccess('CORS origins are configured');
      results.passed++;
    }
  }
}

/**
 * Check documentation
 */
function checkDocumentation() {
  logSection('Documentation');

  const docs = ['README.md', 'CONTRIBUTING.md', 'docs/deployment.md', 'docs/architecture.md'];

  for (const doc of docs) {
    if (existsSync(doc)) {
      logSuccess(`${doc} exists`);
      results.passed++;
    } else {
      logWarning(`${doc} is missing`);
      results.warnings++;
    }
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('');
  log('🚀 SKILLANCER LAUNCH READINESS CHECK', colors.bold + colors.cyan);
  log('═══════════════════════════════════════', colors.cyan);

  const startTime = Date.now();

  // Run all checks
  checkRequiredFiles();
  checkEnvironment();
  checkPackageJson();
  checkServices();
  checkDocumentation();
  checkSecurity();
  checkDocker();

  // Optional checks (can be slow)
  const runFullChecks = process.argv.includes('--full');

  if (runFullChecks) {
    checkTypeScript();
    checkLinting();
    checkTests();
    checkBuild();
    checkDatabase();
  } else {
    logSection('Skipped Checks (use --full)');
    logInfo('TypeScript, Linting, Tests, Build, Database');
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('');
  log('═══════════════════════════════════════', colors.cyan);
  log('📊 SUMMARY', colors.bold);
  console.log('');
  log(`  ✅ Passed:   ${results.passed}`, colors.green);
  log(`  ⚠️  Warnings: ${results.warnings}`, colors.yellow);
  log(`  ❌ Failed:   ${results.failed}`, colors.red);
  console.log('');
  log(`  ⏱️  Time: ${elapsed}s`, colors.blue);

  // Final verdict
  console.log('');
  if (results.failed === 0 && results.warnings === 0) {
    log('🎉 ALL CHECKS PASSED - READY TO LAUNCH!', colors.green + colors.bold);
  } else if (results.failed === 0) {
    log('⚠️  READY WITH WARNINGS - Review before launch', colors.yellow + colors.bold);
  } else {
    log('❌ NOT READY - Fix errors before launch', colors.red + colors.bold);
    console.log('');
    log('Errors:', colors.red);
    for (const error of results.errors) {
      log(`  • ${error}`, colors.red);
    }
  }

  console.log('');

  // Exit code
  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(console.error);
