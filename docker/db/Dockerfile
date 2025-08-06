FROM postgres:15-alpine

# Copy SQL scripts to the standard PostgreSQL init directory
# PostgreSQL will automatically execute these files in alphabetical order on first startup
COPY schema.sql /docker-entrypoint-initdb.d/01-schema.sql

