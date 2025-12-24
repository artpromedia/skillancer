-- PostgreSQL Test Database Initialization Script
-- This script runs when the test database container is first created.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create test schemas for parallel test isolation
CREATE SCHEMA IF NOT EXISTS test_template;
CREATE SCHEMA IF NOT EXISTS test_shared;

-- Grant permissions
GRANT ALL ON SCHEMA test_template TO skillancer_test;
GRANT ALL ON SCHEMA test_shared TO skillancer_test;

-- Create function to clone template schema for test isolation
CREATE OR REPLACE FUNCTION clone_test_schema(source_schema TEXT, target_schema TEXT)
RETURNS VOID AS $$
DECLARE
    obj RECORD;
BEGIN
    -- Create target schema
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', target_schema);
    
    -- Clone tables
    FOR obj IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = source_schema
          AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('CREATE TABLE %I.%I (LIKE %I.%I INCLUDING ALL)',
            target_schema, obj.table_name, source_schema, obj.table_name);
    END LOOP;
    
    -- Clone sequences
    FOR obj IN
        SELECT sequence_name
        FROM information_schema.sequences
        WHERE sequence_schema = source_schema
    LOOP
        EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I.%I',
            target_schema, obj.sequence_name);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to drop test schema
CREATE OR REPLACE FUNCTION drop_test_schema(schema_name TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', schema_name);
END;
$$ LANGUAGE plpgsql;

-- Create function to clean all data from a schema
CREATE OR REPLACE FUNCTION truncate_schema(schema_name TEXT)
RETURNS VOID AS $$
DECLARE
    tbl RECORD;
BEGIN
    -- Disable triggers
    SET session_replication_role = replica;
    
    FOR tbl IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = schema_name
          AND table_type = 'BASE TABLE'
          AND table_name != '_prisma_migrations'
    LOOP
        EXECUTE format('TRUNCATE TABLE %I.%I CASCADE', schema_name, tbl.table_name);
    END LOOP;
    
    -- Re-enable triggers
    SET session_replication_role = DEFAULT;
END;
$$ LANGUAGE plpgsql;

-- Create test user roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'test_readonly') THEN
        CREATE ROLE test_readonly;
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'test_readwrite') THEN
        CREATE ROLE test_readwrite;
    END IF;
END
$$;

-- Grant permissions to roles
GRANT USAGE ON SCHEMA public TO test_readonly, test_readwrite;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO test_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO test_readwrite;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Test database initialized successfully';
END
$$;
