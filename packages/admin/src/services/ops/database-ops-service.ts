/**
 * @module @skillancer/admin/services/ops
 * Database operations service for PostgreSQL
 */

import type { Pool } from 'pg';

export interface DatabaseStats {
  connectionPool: {
    total: number;
    active: number;
    idle: number;
    waiting: number;
    maxConnections: number;
  };
  performance: {
    activeQueries: number;
    avgQueryTime: number;
    slowQueries: number;
    deadlocks: number;
  };
  storage: {
    databaseSize: string;
    tablesCount: number;
    indexesCount: number;
    largestTables: { name: string; size: string; rowCount: number }[];
  };
  replication?: {
    replicaLag: number;
    replicaState: string;
    lastReplayTime: Date;
  };
}

export interface ActiveQuery {
  pid: number;
  username: string;
  database: string;
  query: string;
  state: string;
  waitEventType: string;
  waitEvent: string;
  duration: number;
  startedAt: Date;
}

export interface TableStats {
  name: string;
  schema: string;
  rowCount: number;
  size: string;
  totalSize: string;
  indexSize: string;
  lastVacuum: Date | null;
  lastAnalyze: Date | null;
  deadTuples: number;
  modifiedSinceAnalyze: number;
}

export interface IndexStats {
  name: string;
  tableName: string;
  size: string;
  scans: number;
  tuplesRead: number;
  tuplesFetched: number;
  isUnique: boolean;
  isPrimary: boolean;
  isValid: boolean;
  usage: 'high' | 'medium' | 'low' | 'unused';
}

export interface MigrationInfo {
  version: string;
  name: string;
  appliedAt: Date;
  executionTime: number;
  checksum: string;
}

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export class DatabaseOpsService {
  constructor(
    private pool: Pool,
    private logger: Logger
  ) {}

  // ==================== Database Stats ====================

  async getDatabaseStats(): Promise<DatabaseStats> {
    const [connectionPool, performance, storage, replication] = await Promise.all([
      this.getConnectionPoolStats(),
      this.getPerformanceStats(),
      this.getStorageStats(),
      this.getReplicationStats(),
    ]);

    return {
      connectionPool,
      performance,
      storage,
      replication,
    };
  }

  private async getConnectionPoolStats(): Promise<DatabaseStats['connectionPool']> {
    const result = await this.pool.query(`
      SELECT
        count(*) as total,
        count(*) FILTER (WHERE state = 'active') as active,
        count(*) FILTER (WHERE state = 'idle') as idle,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);

    const row = result.rows[0];

    return {
      total: this.pool.totalCount,
      active: this.pool.totalCount - this.pool.idleCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
      maxConnections: parseInt(row.max_connections),
    };
  }

  private async getPerformanceStats(): Promise<DatabaseStats['performance']> {
    const result = await this.pool.query(`
      SELECT
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND query NOT LIKE '%pg_stat%') as active_queries,
        (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (now() - query_start)) * 1000), 0)
          FROM pg_stat_activity WHERE state = 'active') as avg_query_time,
        (SELECT count(*) FROM pg_stat_activity
          WHERE state = 'active' AND query_start < now() - interval '5 seconds') as slow_queries,
        (SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()) as deadlocks
    `);

    const row = result.rows[0];

    return {
      activeQueries: parseInt(row.active_queries),
      avgQueryTime: parseFloat(row.avg_query_time) || 0,
      slowQueries: parseInt(row.slow_queries),
      deadlocks: parseInt(row.deadlocks) || 0,
    };
  }

  private async getStorageStats(): Promise<DatabaseStats['storage']> {
    const [sizeResult, countsResult, largestTablesResult] = await Promise.all([
      this.pool.query(`SELECT pg_size_pretty(pg_database_size(current_database())) as size`),
      this.pool.query(`
        SELECT
          (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') as tables_count,
          (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public') as indexes_count
      `),
      this.pool.query(`
        SELECT
          relname as name,
          pg_size_pretty(pg_total_relation_size(relid)) as size,
          n_live_tup as row_count
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(relid) DESC
        LIMIT 10
      `),
    ]);

    return {
      databaseSize: sizeResult.rows[0].size,
      tablesCount: parseInt(countsResult.rows[0].tables_count),
      indexesCount: parseInt(countsResult.rows[0].indexes_count),
      largestTables: largestTablesResult.rows.map((row) => ({
        name: row.name,
        size: row.size,
        rowCount: parseInt(row.row_count),
      })),
    };
  }

  private async getReplicationStats(): Promise<DatabaseStats['replication'] | undefined> {
    try {
      const result = await this.pool.query(`
        SELECT
          CASE WHEN pg_is_in_recovery() THEN 'replica' ELSE 'primary' END as role,
          COALESCE(EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())), 0) as lag_seconds,
          pg_is_in_recovery() as is_replica
      `);

      const row = result.rows[0];

      if (!row.is_replica) return undefined;

      return {
        replicaLag: parseFloat(row.lag_seconds),
        replicaState: row.role,
        lastReplayTime: new Date(),
      };
    } catch {
      return undefined;
    }
  }

  // ==================== Active Queries ====================

  async getActiveQueries(): Promise<ActiveQuery[]> {
    const result = await this.pool.query(`
      SELECT
        pid,
        usename as username,
        datname as database,
        query,
        state,
        wait_event_type,
        wait_event,
        EXTRACT(EPOCH FROM (now() - query_start)) * 1000 as duration_ms,
        query_start as started_at
      FROM pg_stat_activity
      WHERE state != 'idle'
        AND pid != pg_backend_pid()
        AND query NOT LIKE '%pg_stat_activity%'
      ORDER BY query_start ASC
    `);

    return result.rows.map((row) => ({
      pid: row.pid,
      username: row.username,
      database: row.database,
      query: row.query,
      state: row.state,
      waitEventType: row.wait_event_type || '',
      waitEvent: row.wait_event || '',
      duration: parseFloat(row.duration_ms) || 0,
      startedAt: row.started_at,
    }));
  }

  async cancelQuery(pid: number): Promise<boolean> {
    const result = await this.pool.query('SELECT pg_cancel_backend($1) as cancelled', [pid]);

    this.logger.warn('Query cancelled', { pid });
    return result.rows[0]?.cancelled || false;
  }

  async terminateBackend(pid: number): Promise<boolean> {
    const result = await this.pool.query('SELECT pg_terminate_backend($1) as terminated', [pid]);

    this.logger.warn('Backend terminated', { pid });
    return result.rows[0]?.terminated || false;
  }

  // ==================== Table & Index Stats ====================

  async getTableStats(): Promise<TableStats[]> {
    const result = await this.pool.query(`
      SELECT
        schemaname as schema,
        relname as name,
        n_live_tup as row_count,
        pg_size_pretty(pg_relation_size(relid)) as size,
        pg_size_pretty(pg_total_relation_size(relid)) as total_size,
        pg_size_pretty(pg_indexes_size(relid)) as index_size,
        last_vacuum,
        last_analyze,
        n_dead_tup as dead_tuples,
        n_mod_since_analyze as modified_since_analyze
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
    `);

    return result.rows.map((row) => ({
      name: row.name,
      schema: row.schema,
      rowCount: parseInt(row.row_count),
      size: row.size,
      totalSize: row.total_size,
      indexSize: row.index_size,
      lastVacuum: row.last_vacuum,
      lastAnalyze: row.last_analyze,
      deadTuples: parseInt(row.dead_tuples),
      modifiedSinceAnalyze: parseInt(row.modified_since_analyze),
    }));
  }

  async getIndexStats(): Promise<IndexStats[]> {
    const result = await this.pool.query(`
      SELECT
        i.indexrelname as name,
        i.relname as table_name,
        pg_size_pretty(pg_relation_size(i.indexrelid)) as size,
        i.idx_scan as scans,
        i.idx_tup_read as tuples_read,
        i.idx_tup_fetch as tuples_fetched,
        ix.indisunique as is_unique,
        ix.indisprimary as is_primary,
        ix.indisvalid as is_valid
      FROM pg_stat_user_indexes i
      JOIN pg_index ix ON i.indexrelid = ix.indexrelid
      ORDER BY i.idx_scan DESC
    `);

    return result.rows.map((row) => {
      const scans = parseInt(row.scans);
      let usage: IndexStats['usage'];

      if (scans > 10000) usage = 'high';
      else if (scans > 1000) usage = 'medium';
      else if (scans > 0) usage = 'low';
      else usage = 'unused';

      return {
        name: row.name,
        tableName: row.table_name,
        size: row.size,
        scans,
        tuplesRead: parseInt(row.tuples_read),
        tuplesFetched: parseInt(row.tuples_fetched),
        isUnique: row.is_unique,
        isPrimary: row.is_primary,
        isValid: row.is_valid,
        usage,
      };
    });
  }

  async getUnusedIndexes(): Promise<IndexStats[]> {
    const indexes = await this.getIndexStats();
    return indexes.filter((idx) => idx.usage === 'unused' && !idx.isPrimary && !idx.isUnique);
  }

  async getMissingIndexes(): Promise<
    {
      table: string;
      columns: string;
      seqScans: number;
      rowsRead: number;
      recommendation: string;
    }[]
  > {
    const result = await this.pool.query(`
      SELECT
        schemaname || '.' || relname as table,
        seq_scan as seq_scans,
        seq_tup_read as rows_read,
        n_live_tup as live_tuples
      FROM pg_stat_user_tables
      WHERE seq_scan > 1000
        AND seq_tup_read > 100000
        AND n_live_tup > 10000
      ORDER BY seq_tup_read DESC
      LIMIT 20
    `);

    return result.rows.map((row) => ({
      table: row.table,
      columns: 'Analyze query patterns to identify columns',
      seqScans: parseInt(row.seq_scans),
      rowsRead: parseInt(row.rows_read),
      recommendation: `Table ${row.table} has ${row.seq_scans} sequential scans reading ${row.rows_read} rows. Consider adding indexes on frequently filtered columns.`,
    }));
  }

  // ==================== Maintenance Operations ====================

  async vacuumTable(
    tableName: string,
    options: { full?: boolean; analyze?: boolean } = {}
  ): Promise<void> {
    let query = 'VACUUM';
    if (options.full) query += ' FULL';
    if (options.analyze) query += ' ANALYZE';
    query += ` ${tableName}`;

    await this.pool.query(query);
    this.logger.info('Table vacuumed', { tableName, options });
  }

  async analyzeTable(tableName: string): Promise<void> {
    await this.pool.query(`ANALYZE ${tableName}`);
    this.logger.info('Table analyzed', { tableName });
  }

  async reindexTable(tableName: string): Promise<void> {
    await this.pool.query(`REINDEX TABLE ${tableName}`);
    this.logger.info('Table reindexed', { tableName });
  }

  async reindexIndex(indexName: string): Promise<void> {
    await this.pool.query(`REINDEX INDEX ${indexName}`);
    this.logger.info('Index reindexed', { indexName });
  }

  // ==================== Locks ====================

  async getActiveLocks(): Promise<
    {
      pid: number;
      lockType: string;
      database: string;
      relation: string;
      mode: string;
      granted: boolean;
      waitingPid: number | null;
    }[]
  > {
    const result = await this.pool.query(`
      SELECT
        l.pid,
        l.locktype as lock_type,
        d.datname as database,
        c.relname as relation,
        l.mode,
        l.granted,
        bl.pid as waiting_pid
      FROM pg_locks l
      LEFT JOIN pg_database d ON l.database = d.oid
      LEFT JOIN pg_class c ON l.relation = c.oid
      LEFT JOIN pg_locks bl ON l.relation = bl.relation AND l.pid != bl.pid AND NOT bl.granted
      WHERE l.pid != pg_backend_pid()
      ORDER BY l.pid
    `);

    return result.rows.map((row) => ({
      pid: row.pid,
      lockType: row.lock_type,
      database: row.database || '',
      relation: row.relation || '',
      mode: row.mode,
      granted: row.granted,
      waitingPid: row.waiting_pid,
    }));
  }

  async getBlockingQueries(): Promise<
    {
      blockedPid: number;
      blockedQuery: string;
      blockedDuration: number;
      blockingPid: number;
      blockingQuery: string;
      blockingDuration: number;
    }[]
  > {
    const result = await this.pool.query(`
      SELECT
        blocked.pid as blocked_pid,
        blocked.query as blocked_query,
        EXTRACT(EPOCH FROM (now() - blocked.query_start)) as blocked_duration,
        blocking.pid as blocking_pid,
        blocking.query as blocking_query,
        EXTRACT(EPOCH FROM (now() - blocking.query_start)) as blocking_duration
      FROM pg_stat_activity blocked
      JOIN pg_locks blocked_locks ON blocked.pid = blocked_locks.pid
      JOIN pg_locks blocking_locks ON blocked_locks.locktype = blocking_locks.locktype
        AND blocked_locks.database IS NOT DISTINCT FROM blocking_locks.database
        AND blocked_locks.relation IS NOT DISTINCT FROM blocking_locks.relation
        AND blocked_locks.pid != blocking_locks.pid
      JOIN pg_stat_activity blocking ON blocking_locks.pid = blocking.pid
      WHERE NOT blocked_locks.granted
        AND blocking_locks.granted
    `);

    return result.rows.map((row) => ({
      blockedPid: row.blocked_pid,
      blockedQuery: row.blocked_query,
      blockedDuration: parseFloat(row.blocked_duration),
      blockingPid: row.blocking_pid,
      blockingQuery: row.blocking_query,
      blockingDuration: parseFloat(row.blocking_duration),
    }));
  }

  // ==================== Migrations ====================

  async getMigrations(): Promise<MigrationInfo[]> {
    try {
      const result = await this.pool.query(`
        SELECT
          version,
          name,
          applied_at,
          execution_time,
          checksum
        FROM schema_migrations
        ORDER BY applied_at DESC
      `);

      return result.rows.map((row) => ({
        version: row.version,
        name: row.name,
        appliedAt: row.applied_at,
        executionTime: parseInt(row.execution_time),
        checksum: row.checksum,
      }));
    } catch {
      // Migration table might not exist
      return [];
    }
  }

  async getPendingMigrations(): Promise<{ version: string; name: string }[]> {
    // This would integrate with the migration tool
    return [];
  }
}
