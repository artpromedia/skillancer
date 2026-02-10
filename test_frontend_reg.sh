#!/bin/bash
TIMESTAMP=$(date +%s)
EMAIL="frontendtest_${TIMESTAMP}@test.com"
echo "Testing registration via skillancer.com/api/auth/register with email: $EMAIL"
curl -s -w '\nHTTP_STATUS: %{http_code}\nTIME: %{time_total}s\n' \
  -X POST https://skillancer.com/api/auth/register \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://skillancer.com' \
  -d '{"firstName":"Frontend","lastName":"Test","email":"'"$EMAIL"'","password":"SecurePass123!"}'
