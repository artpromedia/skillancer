#!/usr/bin/env tsx
/**
 * @module check-destructive-migrations
 * Detects potentially destructive operations in pending Prisma migrations
 *
 * Checks for:
 * - DROP TABLE / DROP COLUMN / DROP INDEX
 * - DELETE FROM / TRUNCATE
 * - ALTER TABLE ... DROP
 *
 * Exit codes:
 * - 0: No destructive changes found
 * - 1: Destructive changes detected
 * - 2: Error during analysis
 *
 * Usage:
 *   pnpm db:check-destructive
 *   tsx scripts/check-destructive-migrations.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations');

/**
 * Patterns that indicate destructive operations
 * Each pattern includes a regex and a human-readable description
 */
const DESTRUCTIVE_PATTERNS: Array<{ pattern: RegExp; description: string; severity: 'high' | 'medium' }> = [
  // Table operations
  { pattern: /DROP\s+TABLE/gi, description: 'DROP TABLE - Removes entire table and all data', severity: 'high' },
  { pattern: /TRUNCATE\s+TABLE/gi, description: 'TRUNCATE TABLE - Removes all rows from table', severity: 'high' },
  { pattern: /TRUNCATE\s+["']?\w+["']?/gi, description: 'TRUNCATE - Removes all rows', severity: 'high' },

  // Column operations
  { pattern: /ALTER\s+TABLE\s+["']?\w+["']?\s+DROP\s+COLUMN/gi, description: 'DROP COLUMN - Removes column and its data', severity: 'high' },
  { pattern: /ALTER\s+TABLE\s+["']?\w+["']?\s+DROP\s+CONSTRAINT/gi, description: 'DROP CONSTRAINT - Removes constraint', severity: 'medium' },

  // Index operations (medium severity - usually safe but can affect performance)
  { pattern: /DROP\s+INDEX/gi, description: 'DROP INDEX - Removes index', severity: 'medium' },

  // Data operations
  { pattern: /DELETE\s+FROM/gi, description: 'DELETE FROM - Removes rows from table', severity: 'high' },

  // Type changes that may cause data loss
  { pattern: /ALTER\s+TABLE\s+["']?\w+["']?\s+ALTER\s+COLUMN\s+["']?\w+["']?\s+TYPE/gi, description: 'ALTER COLUMN TYPE - May cause data loss on type conversion', severity: 'medium' },

  // Schema operations
  { pattern: /DROP\s+SCHEMA/gi, description: 'DROP SCHEMA - Removes entire schema', severity: 'high' },
  { pattern: /DROP\s+DATABASE/gi, description: 'DROP DATABASE - Removes entire database', severity: 'high' },

  // Enum modifications (can be destructive in PostgreSQL)
  { pattern: /DROP\s+TYPE/gi, description: 'DROP TYPE - Removes custom type/enum', severity: 'medium' },
];

// ============================================================================
// TYPES
// ============================================================================

interface DestructiveMatch {
  file: string;
  line: number;
  content: string;
  description: string;
  severity: 'high' | 'medium';
}

interface AnalysisResult {
  hasDestructive: boolean;
  matches: DestructiveMatch[];
  filesAnalyzed: number;
  pendingMigrations: string[];
}

// ============================================================================
// FUNCTIONS
// ============================================================================

/**
 * Get list of migration directories sorted by name (timestamp)
 */
function getMigrationDirs(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .sort();
}

/**
 * Read migration SQL file content
 */
function readMigrationFile(migrationDir: string): string | null {
  const sqlPath = path.join(MIGRATIONS_DIR, migrationDir, 'migration.sql');
  
  if (!fs.existsSync(sqlPath)) {
    return null;
  }

  return fs.readFileSync(sqlPath, 'utf-8');
}

/**
 * Analyze SQL content for destructive patterns
 */
function analyzeSQL(sql: string, fileName: string): DestructiveMatch[] {
  const matches: DestructiveMatch[] = [];
  const lines = sql.split('\n');

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum]!;
    
    // Skip comments
    if (line.trim().startsWith('--')) continue;

    for (const { pattern, description, severity } of DESTRUCTIVE_PATTERNS) {
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;
      
      if (pattern.test(line)) {
        matches.push({
          file: fileName,
          line: lineNum + 1,
          content: line.trim().substring(0, 100) + (line.length > 100 ? '...' : ''),
          description,
          severity,
        });
      }
    }
  }

  return matches;
}

/**
 * Main analysis function
 */
function analyzeMigrations(): AnalysisResult {
  const migrations = getMigrationDirs();
  const allMatches: DestructiveMatch[] = [];
  let filesAnalyzed = 0;

  console.log('🔍 Analyzing migrations for destructive changes...\n');

  for (const migration of migrations) {
    const sql = readMigrationFile(migration);
    
    if (sql === null) {
      continue;
    }

    filesAnalyzed++;
    const matches = analyzeSQL(sql, migration);
    allMatches.push(...matches);
  }

  return {
    hasDestructive: allMatches.length > 0,
    matches: allMatches,
    filesAnalyzed,
    pendingMigrations: migrations,
  };
}

/**
 * Format and print results
 */
function printResults(result: AnalysisResult): void {
  console.log(`📁 Migrations directory: ${MIGRATIONS_DIR}`);
  console.log(`📊 Files analyzed: ${result.filesAnalyzed}`);
  console.log(`📋 Total migrations: ${result.pendingMigrations.length}\n`);

  if (!result.hasDestructive) {
    console.log('✅ No destructive changes detected!\n');
    console.log('All migrations appear safe for automatic deployment.');
    return;
  }

  console.log('⚠️  DESTRUCTIVE CHANGES DETECTED!\n');
  console.log('The following potentially destructive operations were found:\n');

  // Group by severity
  const highSeverity = result.matches.filter((m) => m.severity === 'high');
  const mediumSeverity = result.matches.filter((m) => m.severity === 'medium');

  if (highSeverity.length > 0) {
    console.log('🔴 HIGH SEVERITY (Data Loss Risk):');
    console.log('─'.repeat(60));
    for (const match of highSeverity) {
      console.log(`  File: ${match.file}`);
      console.log(`  Line: ${match.line}`);
      console.log(`  Type: ${match.description}`);
      console.log(`  SQL:  ${match.content}`);
      console.log('');
    }
  }

  if (mediumSeverity.length > 0) {
    console.log('🟡 MEDIUM SEVERITY (Review Recommended):');
    console.log('─'.repeat(60));
    for (const match of mediumSeverity) {
      console.log(`  File: ${match.file}`);
      console.log(`  Line: ${match.line}`);
      console.log(`  Type: ${match.description}`);
      console.log(`  SQL:  ${match.content}`);
      console.log('');
    }
  }

  console.log('─'.repeat(60));
  console.log('\n📋 Required Actions:');
  console.log('  1. Review each destructive change carefully');
  console.log('  2. Ensure data backups are in place');
  console.log('  3. Document rollback procedures');
  console.log('  4. Manual approval required for production deployment');
  console.log('');
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

try {
  const result = analyzeMigrations();
  printResults(result);

  if (result.hasDestructive) {
    const highCount = result.matches.filter((m) => m.severity === 'high').length;
    const mediumCount = result.matches.filter((m) => m.severity === 'medium').length;
    
    console.log(`Summary: ${highCount} high severity, ${mediumCount} medium severity issues found.`);
    process.exit(1);
  }

  process.exit(0);
} catch (error) {
  console.error('❌ Error analyzing migrations:', error);
  process.exit(2);
}
