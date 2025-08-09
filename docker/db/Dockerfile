FROM postgres:15-alpine

# Copy SQL scripts to the standard PostgreSQL init directory
# schema.sql should be generated from Prisma with db/generate-schema-sql.sh
COPY schema.sql /docker-entrypoint-initdb.d/01-schema.sql
COPY fill.sql /docker-entrypoint-initdb.d/02-fill.sql
