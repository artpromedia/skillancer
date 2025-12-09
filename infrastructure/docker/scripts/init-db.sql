-- ===========================================
-- Skillancer Database Initialization Script
-- ===========================================
-- This script runs when the PostgreSQL container is first created

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Create additional databases for testing
CREATE DATABASE skillancer_test;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE skillancer_dev TO skillancer;
GRANT ALL PRIVILEGES ON DATABASE skillancer_test TO skillancer;

-- Connect to skillancer_test and create extensions
\c skillancer_test
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Switch back to main database
\c skillancer_dev

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Skillancer database initialization complete!';
END $$;
