#!/bin/bash
set -e

# Check if we need to initialize the database
if [ ! -f /var/lib/postgresql/data/PG_VERSION ]; then
    echo "First time setup - database will be initialized"
    # Initialize PostgreSQL first
    docker-entrypoint.sh postgres &
    POSTGRES_PID=$!
    
    # Wait for postgres to start
    until pg_isready -U "$POSTGRES_USER" >/dev/null 2>&1; do
        echo "Waiting for PostgreSQL to start..."
        sleep 1
    done
    
    echo "PostgreSQL started, creating database and running scripts..."
    
    # Check if database already exists
    DB_EXISTS=$(psql -U "$POSTGRES_USER" -lqt | cut -d \| -f 1 | grep -wc "$POSTGRES_DB" || echo "0")
    
    if [ "$DB_EXISTS" -eq "0" ]; then
        echo "Creating database $POSTGRES_DB..."
        createdb -U "$POSTGRES_USER" "$POSTGRES_DB"
    else
        echo "Database $POSTGRES_DB already exists"
    fi
    
    echo "Running schema.sql..."
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /scripts/schema.sql
    echo "Running fill.sql..."
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /scripts/fill.sql
    echo "Database initialization completed successfully!"
    
    # Stop the temporary postgres instance
    kill $POSTGRES_PID
    wait $POSTGRES_PID 2>/dev/null || true
else
    echo "Database already exists - checking if init scripts need to run"
    
    # Start postgres in background as postgres user to check database state
    su-exec postgres postgres -D /var/lib/postgresql/data &
    POSTGRES_PID=$!
    
    # Wait for postgres to start
    until su-exec postgres pg_isready -U "$POSTGRES_USER" >/dev/null 2>&1; do
        echo "Waiting for PostgreSQL to start..."
        sleep 1
    done
    
    # Check if our database and tables exist
    DB_EXISTS=$(su-exec postgres psql -U "$POSTGRES_USER" -lqt | cut -d \| -f 1 | grep -wc "$POSTGRES_DB" || echo "0")
    
    if [ "$DB_EXISTS" -eq "0" ]; then
        echo "Database $POSTGRES_DB does not exist - creating and initializing"
        su-exec postgres createdb -U "$POSTGRES_USER" "$POSTGRES_DB"
        echo "Running schema.sql..."
        su-exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /scripts/schema.sql
        echo "Running fill.sql..."
        su-exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /scripts/fill.sql
        echo "Database initialization completed successfully!"
    else
        # Check if tables exist
        TABLE_COUNT=$(su-exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
        
        if [ "$TABLE_COUNT" -eq "0" ]; then
            echo "Database exists but no tables found - running initialization"
            echo "Running schema.sql..."
            su-exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /scripts/schema.sql
            echo "Running fill.sql..."
            su-exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /scripts/fill.sql
            echo "Database initialization completed successfully!"
        else
            echo "Database and tables already exist - skipping initialization"
        fi
    fi
    
    # Stop the temporary postgres instance
    kill $POSTGRES_PID
    wait $POSTGRES_PID 2>/dev/null || true
fi

# Now start postgres normally
exec docker-entrypoint.sh "$@"
