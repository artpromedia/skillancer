#!/bin/bash
TIMESTAMP=$(date +%s)
EMAIL="newuser_${TIMESTAMP}@test.com"
echo "Testing registration with email: $EMAIL"
curl -s -w '\nHTTP_STATUS: %{http_code}\nTIME: %{time_total}s\n' \
  -X POST http://localhost:30040/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"firstName":"Test","lastName":"NewUser","email":"'"$EMAIL"'","password":"SecurePass123!"}'
echo ''
echo '=== auth-svc logs ==='
kubectl -n skillancer logs deploy/auth-svc --tail=10 --all-containers 2>/dev/null | grep -i 'register\|error\|created' | tail -10
