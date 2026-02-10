#!/bin/bash
curl -v -X POST http://localhost:30040/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","email":"testsignup99@test.com","password":"TestPass123!@#"}' 2>&1
echo ""
