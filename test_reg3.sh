#!/bin/bash
echo "=== Testing registration ==="
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:30040/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","email":"testsignup99@test.com","password":"TestPass123!@#"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)
echo "HTTP Status: $HTTP_CODE"
echo "Response: $BODY"
echo ""
echo "=== Checking api-gateway logs ==="
sleep 1
kubectl -n skillancer logs -l app=api-gateway --since=10s 2>&1 | grep -v health | head -10
echo ""
echo "=== Checking auth-svc logs ==="
kubectl -n skillancer logs -l app=auth-svc --since=10s 2>&1 | grep -v health | grep -v ioredis | head -10
