#!/bin/bash
set -e

echo "Configuring PostgreSQL and Redis to accept connections from K3s pods..."

# -----------------------------------------------
# PostgreSQL: Listen on all interfaces
# -----------------------------------------------
echo "1. Configuring PostgreSQL..."

# Update listen_addresses
sed -i "s/^#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/16/main/postgresql.conf

# Allow connections from K3s pod CIDR (10.42.0.0/16)
if ! grep -q "10.42.0.0/16" /etc/postgresql/16/main/pg_hba.conf; then
  echo "" >> /etc/postgresql/16/main/pg_hba.conf
  echo "# K3s pods" >> /etc/postgresql/16/main/pg_hba.conf
  echo "host    all    all    10.42.0.0/16    scram-sha-256" >> /etc/postgresql/16/main/pg_hba.conf
fi

systemctl restart postgresql
echo "   PostgreSQL restarted — listening on all interfaces"

# -----------------------------------------------
# Redis: Bind to localhost + K3s gateway
# -----------------------------------------------
echo "2. Configuring Redis..."

# Update bind directive to include K3s gateway IP
REDIS_CONF=$(find /etc/redis -name "*.conf" | head -1)
if [ -n "$REDIS_CONF" ]; then
  sed -i "s/^bind .*/bind 127.0.0.1 10.42.0.1/" "$REDIS_CONF"
  systemctl restart redis-server 2>/dev/null || systemctl restart redis 2>/dev/null
  echo "   Redis restarted — bound to 127.0.0.1 + 10.42.0.1"
else
  echo "   WARNING: Redis config not found, skipping"
fi

# -----------------------------------------------
# Verify
# -----------------------------------------------
echo ""
echo "3. Verifying..."
pg_isready -h 10.42.0.1 -p 5432 && echo "   PostgreSQL: OK on 10.42.0.1" || echo "   PostgreSQL: FAIL on 10.42.0.1"
redis-cli -h 10.42.0.1 -a Nrh3PYiS1ovqK41Aguh8WHHKTVuMg9jR ping 2>/dev/null && echo "   Redis: OK on 10.42.0.1" || echo "   Redis: FAIL on 10.42.0.1"

echo ""
echo "Done. K3s pods can now reach PostgreSQL and Redis at 10.42.0.1"
