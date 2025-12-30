/**
 * Migration Verification Script
 *
 * Verifies database integrity after migrations:
 * - Schema consistency check
 * - Data integrity validation
 * - Foreign key verification
 * - Index verification
 * - Constraint validation
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface VerificationResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: unknown;
}

const results: VerificationResult[] = [];

async function main() {
  console.log('🔍 Starting migration verification...\n');

  try {
    // Schema consistency
    await verifySchemaConsistency();

    // Data integrity
    await verifyDataIntegrity();

    // Foreign key relationships
    await verifyForeignKeys();

    // Index verification
    await verifyIndexes();

    // Constraint validation
    await verifyConstraints();

    // Print results
    printResults();

    // Exit with appropriate code
    const hasFailures = results.some((r) => r.status === 'FAIL');
    if (hasFailures) {
      console.log('\n❌ Verification failed! Review issues above.');
      process.exit(1);
    } else {
      console.log('\n✅ All verification checks passed!');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Verification script error:', error);
    process.exit(1);
  }
}

async function verifySchemaConsistency() {
  console.log('📋 Checking schema consistency...');

  // Check if all expected tables exist
  const expectedTables = [
    'users',
    'profiles',
    'companies',
    'jobs',
    'proposals',
    'contracts',
    'milestones',
    'time_entries',
    'payments',
    'reviews',
    'messages',
    'notifications',
    'skill_categories',
    'skills',
    'skillpod_sessions',
    'skillpod_policies',
    'audit_logs',
  ];

  const existingTables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public'
  `;

  const tableNames = existingTables.map((t) => t.tablename);

  for (const table of expectedTables) {
    if (tableNames.includes(table)) {
      results.push({
        check: `Table exists: ${table}`,
        status: 'PASS',
        message: 'Table found in database',
      });
    } else {
      results.push({
        check: `Table exists: ${table}`,
        status: 'FAIL',
        message: 'Table not found in database',
      });
    }
  }
}

async function verifyDataIntegrity() {
  console.log('🔗 Checking data integrity...');

  // Check for orphaned profiles (profiles without users)
  const orphanedProfiles = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM profiles p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE u.id IS NULL
  `;

  const orphanedProfileCount = Number(orphanedProfiles[0]?.count || 0);
  results.push({
    check: 'No orphaned profiles',
    status: orphanedProfileCount === 0 ? 'PASS' : 'FAIL',
    message:
      orphanedProfileCount === 0
        ? 'All profiles have associated users'
        : `Found ${orphanedProfileCount} orphaned profiles`,
  });

  // Check for orphaned proposals
  const orphanedProposals = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM proposals p
    LEFT JOIN jobs j ON p.job_id = j.id
    WHERE j.id IS NULL
  `;

  const orphanedProposalCount = Number(orphanedProposals[0]?.count || 0);
  results.push({
    check: 'No orphaned proposals',
    status: orphanedProposalCount === 0 ? 'PASS' : 'FAIL',
    message:
      orphanedProposalCount === 0
        ? 'All proposals have associated jobs'
        : `Found ${orphanedProposalCount} orphaned proposals`,
  });

  // Check for orphaned contracts
  const orphanedContracts = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM contracts c
    LEFT JOIN users f ON c.freelancer_id = f.id
    LEFT JOIN users cl ON c.client_id = cl.id
    WHERE f.id IS NULL OR cl.id IS NULL
  `;

  const orphanedContractCount = Number(orphanedContracts[0]?.count || 0);
  results.push({
    check: 'No orphaned contracts',
    status: orphanedContractCount === 0 ? 'PASS' : 'FAIL',
    message:
      orphanedContractCount === 0
        ? 'All contracts have associated users'
        : `Found ${orphanedContractCount} orphaned contracts`,
  });

  // Check for duplicate emails
  const duplicateEmails = await prisma.$queryRaw<{ email: string; count: bigint }[]>`
    SELECT email, COUNT(*) as count FROM users
    GROUP BY email HAVING COUNT(*) > 1
  `;

  results.push({
    check: 'No duplicate emails',
    status: duplicateEmails.length === 0 ? 'PASS' : 'FAIL',
    message:
      duplicateEmails.length === 0
        ? 'All user emails are unique'
        : `Found ${duplicateEmails.length} duplicate email(s)`,
    details: duplicateEmails.length > 0 ? duplicateEmails : undefined,
  });

  // Check for null required fields
  const nullRequiredFields = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM users
    WHERE email IS NULL OR role IS NULL OR status IS NULL
  `;

  const nullCount = Number(nullRequiredFields[0]?.count || 0);
  results.push({
    check: 'No null required fields in users',
    status: nullCount === 0 ? 'PASS' : 'FAIL',
    message:
      nullCount === 0
        ? 'All required user fields are populated'
        : `Found ${nullCount} users with null required fields`,
  });
}

async function verifyForeignKeys() {
  console.log('🔑 Checking foreign key relationships...');

  // Get all foreign keys
  const foreignKeys = await prisma.$queryRaw<
    {
      constraint_name: string;
      table_name: string;
      column_name: string;
      foreign_table_name: string;
      foreign_column_name: string;
    }[]
  >`
    SELECT
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
  `;

  results.push({
    check: 'Foreign keys exist',
    status: foreignKeys.length > 0 ? 'PASS' : 'WARN',
    message: `Found ${foreignKeys.length} foreign key constraints`,
  });

  // Verify each FK relationship has valid references
  for (const fk of foreignKeys.slice(0, 10)) {
    // Check first 10 to avoid too many queries
    const invalidRefs = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
      SELECT COUNT(*) as count FROM "${fk.table_name}" t
      LEFT JOIN "${fk.foreign_table_name}" f ON t."${fk.column_name}" = f."${fk.foreign_column_name}"
      WHERE t."${fk.column_name}" IS NOT NULL AND f."${fk.foreign_column_name}" IS NULL
    `);

    const invalidCount = Number(invalidRefs[0]?.count || 0);
    if (invalidCount > 0) {
      results.push({
        check: `FK ${fk.constraint_name}`,
        status: 'FAIL',
        message: `Found ${invalidCount} invalid references`,
      });
    }
  }
}

async function verifyIndexes() {
  console.log('📊 Checking indexes...');

  // Get all indexes
  const indexes = await prisma.$queryRaw<
    {
      tablename: string;
      indexname: string;
      indexdef: string;
    }[]
  >`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `;

  results.push({
    check: 'Indexes exist',
    status: indexes.length > 0 ? 'PASS' : 'WARN',
    message: `Found ${indexes.length} indexes`,
  });

  // Check for critical indexes
  const criticalIndexes = [
    { table: 'users', column: 'email' },
    { table: 'jobs', column: 'status' },
    { table: 'jobs', column: 'client_id' },
    { table: 'proposals', column: 'job_id' },
    { table: 'contracts', column: 'freelancer_id' },
    { table: 'contracts', column: 'client_id' },
  ];

  for (const critical of criticalIndexes) {
    const hasIndex = indexes.some(
      (idx) => idx.tablename === critical.table && idx.indexdef.includes(critical.column)
    );

    results.push({
      check: `Index on ${critical.table}.${critical.column}`,
      status: hasIndex ? 'PASS' : 'WARN',
      message: hasIndex ? 'Index exists' : 'Missing recommended index',
    });
  }

  // Check for unused indexes (warning only)
  const unusedIndexes = await prisma.$queryRaw<
    {
      indexrelname: string;
      idx_scan: bigint;
    }[]
  >`
    SELECT indexrelname, idx_scan
    FROM pg_stat_user_indexes
    WHERE idx_scan = 0
    AND indexrelname NOT LIKE '%pkey%'
    LIMIT 10
  `;

  if (unusedIndexes.length > 0) {
    results.push({
      check: 'Unused indexes',
      status: 'WARN',
      message: `Found ${unusedIndexes.length} potentially unused indexes`,
      details: unusedIndexes.map((i) => i.indexrelname),
    });
  }
}

async function verifyConstraints() {
  console.log('✅ Checking constraints...');

  // Get all check constraints
  const checkConstraints = await prisma.$queryRaw<
    {
      constraint_name: string;
      table_name: string;
      check_clause: string;
    }[]
  >`
    SELECT 
      tc.constraint_name,
      tc.table_name,
      cc.check_clause
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc
      ON tc.constraint_name = cc.constraint_name
    WHERE tc.constraint_type = 'CHECK'
    AND tc.table_schema = 'public'
  `;

  results.push({
    check: 'Check constraints',
    status: checkConstraints.length > 0 ? 'PASS' : 'WARN',
    message: `Found ${checkConstraints.length} check constraints`,
  });

  // Get unique constraints
  const uniqueConstraints = await prisma.$queryRaw<
    {
      constraint_name: string;
      table_name: string;
    }[]
  >`
    SELECT constraint_name, table_name
    FROM information_schema.table_constraints
    WHERE constraint_type = 'UNIQUE'
    AND table_schema = 'public'
  `;

  results.push({
    check: 'Unique constraints',
    status: uniqueConstraints.length > 0 ? 'PASS' : 'WARN',
    message: `Found ${uniqueConstraints.length} unique constraints`,
  });

  // Verify email uniqueness constraint exists
  const emailUnique = uniqueConstraints.some(
    (c) => c.table_name === 'users' && c.constraint_name.includes('email')
  );

  results.push({
    check: 'Email uniqueness constraint',
    status: emailUnique ? 'PASS' : 'FAIL',
    message: emailUnique ? 'Email uniqueness enforced' : 'Missing email uniqueness constraint',
  });
}

function printResults() {
  console.log('\n' + '='.repeat(60));
  console.log('VERIFICATION RESULTS');
  console.log('='.repeat(60) + '\n');

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const warned = results.filter((r) => r.status === 'WARN').length;

  console.log(`Total Checks: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warned}`);
  console.log('\n' + '-'.repeat(60) + '\n');

  // Print failures first
  const failures = results.filter((r) => r.status === 'FAIL');
  if (failures.length > 0) {
    console.log('❌ FAILURES:\n');
    for (const result of failures) {
      console.log(`  ${result.check}`);
      console.log(`     ${result.message}`);
      if (result.details) {
        console.log(`     Details: ${JSON.stringify(result.details)}`);
      }
      console.log('');
    }
  }

  // Print warnings
  const warnings = results.filter((r) => r.status === 'WARN');
  if (warnings.length > 0) {
    console.log('⚠️  WARNINGS:\n');
    for (const result of warnings) {
      console.log(`  ${result.check}`);
      console.log(`     ${result.message}`);
      console.log('');
    }
  }
}

main()
  .catch((e) => {
    console.error('❌ Verification failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
