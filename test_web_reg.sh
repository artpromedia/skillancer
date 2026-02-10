#!/bin/bash
TIMESTAMP=$(date +%s)
EMAIL="webtest_${TIMESTAMP}@test.com"
echo "Testing registration via api.skillancer.com with email: $EMAIL"
curl -s -w '\nHTTP_STATUS: %{http_code}\nTIME: %{time_total}s\n' \
  -X POST https://api.skillancer.com/api/auth/register \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://skillancer.com' \
  -d '{"firstName":"Web","lastName":"Test","email":"'"$EMAIL"'","password":"SecurePass123!"}'
