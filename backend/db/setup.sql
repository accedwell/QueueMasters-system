-- QueueMasters: one-time PostgreSQL setup.
-- Run as the postgres superuser, e.g. from the project root:
--   "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f backend\db\setup.sql
--
-- Creates the application role and database that application.properties connects to by default.
-- The tables themselves are created by the backend on first start (spring.jpa.hibernate.ddl-auto=update).

SELECT 'CREATE ROLE queuemasters LOGIN PASSWORD ''queuemasters123'''
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'queuemasters')\gexec

SELECT 'CREATE DATABASE queuemasters OWNER queuemasters'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'queuemasters')\gexec

\connect queuemasters
GRANT ALL ON SCHEMA public TO queuemasters;
