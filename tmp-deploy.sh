#!/bin/bash
set -e

MANIFEST_DIR="/opt/skillancer/infrastructure/kubernetes/production/manifests"

echo "========================================="
echo "  Skillancer K3s Deployment"
echo "========================================="
echo ""

# -----------------------------------------------
# 1. Create namespace
# -----------------------------------------------
echo "1. Creating namespace..."
kubectl apply -f "$MANIFEST_DIR/00-namespace.yaml"
echo "   OK"
echo ""

# -----------------------------------------------
# 2. Create secrets with real credentials
# -----------------------------------------------
echo "2. Creating secrets..."

# Read credentials from provisioning
source /root/.skillancer-credentials 2>/dev/null || true

PG_PASSWORD="${PG_PASSWORD:-P8KD2OeTfMuPRZzeuypVNcqUyb9kUEyH}"
REDIS_PASSWORD="${REDIS_PASSWORD:-Nrh3PYiS1ovqK41Aguh8WHHKTVuMg9jR}"

# Generate JWT secrets
JWT_SECRET=$(openssl rand -base64 48)
JWT_REFRESH_SECRET=$(openssl rand -base64 48)
SESSION_SECRET=$(openssl rand -base64 48)

# Delete existing secret if any
kubectl delete secret skillancer-secrets -n skillancer 2>/dev/null || true

kubectl create secret generic skillancer-secrets \
  --namespace skillancer \
  --from-literal=DATABASE_URL="postgresql://skillancer_admin:${PG_PASSWORD}@10.42.0.1:5432/skillancer" \
  --from-literal=PG_PASSWORD="${PG_PASSWORD}" \
  --from-literal=REDIS_URL="redis://:${REDIS_PASSWORD}@10.42.0.1:6379/0" \
  --from-literal=REDIS_PASSWORD="${REDIS_PASSWORD}" \
  --from-literal=JWT_SECRET="${JWT_SECRET}" \
  --from-literal=JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET}" \
  --from-literal=SESSION_SECRET="${SESSION_SECRET}" \
  --from-literal=STRIPE_SECRET_KEY="placeholder" \
  --from-literal=STRIPE_WEBHOOK_SECRET="placeholder" \
  --from-literal=STRIPE_PUBLISHABLE_KEY="placeholder" \
  --from-literal=S3_ENDPOINT="https://56f34d4c32d7deeeb917c5e27e0083ac.r2.cloudflarestorage.com" \
  --from-literal=S3_ACCESS_KEY="placeholder" \
  --from-literal=S3_SECRET_KEY="placeholder" \
  --from-literal=S3_BUCKET="skillancer-production-uploads" \
  --from-literal=S3_REGION="auto" \
  --from-literal=SMTP_HOST="placeholder" \
  --from-literal=SMTP_PORT="587" \
  --from-literal=SMTP_USER="placeholder" \
  --from-literal=SMTP_PASSWORD="placeholder" \
  --from-literal=SMTP_FROM="noreply@skillancer.com" \
  --from-literal=OPENAI_API_KEY="placeholder" \
  --from-literal=FIREBASE_PROJECT_ID="placeholder" \
  --from-literal=FIREBASE_CLIENT_EMAIL="placeholder" \
  --from-literal=FIREBASE_PRIVATE_KEY="placeholder"

echo "   OK — secrets created"
echo "   JWT_SECRET generated: ${JWT_SECRET:0:12}..."
echo ""

# -----------------------------------------------
# 3. Apply ConfigMap
# -----------------------------------------------
echo "3. Applying ConfigMap..."
kubectl apply -f "$MANIFEST_DIR/02-configmap.yaml"
echo "   OK"
echo ""

# -----------------------------------------------
# 4. Database migrations (Prisma)
# -----------------------------------------------
echo "4. Running database migrations..."
# Use the auth-svc image which has Prisma client
docker run --rm --network host \
  -e DATABASE_URL="postgresql://skillancer_admin:${PG_PASSWORD}@127.0.0.1:5432/skillancer" \
  skillancer/auth-svc:latest \
  npx prisma migrate deploy 2>/dev/null || {
    echo "   WARNING: Prisma migrate skipped (may need schema push instead)"
    docker run --rm --network host \
      -e DATABASE_URL="postgresql://skillancer_admin:${PG_PASSWORD}@127.0.0.1:5432/skillancer" \
      skillancer/auth-svc:latest \
      npx prisma db push --accept-data-loss 2>/dev/null || echo "   WARNING: Prisma db push also skipped"
  }
echo ""

# -----------------------------------------------
# 5. Deploy all manifests
# -----------------------------------------------
echo "5. Deploying manifests..."

# Frontend apps
for f in 10-web-market.yaml 11-web-cockpit.yaml 12-web-skillpod.yaml 13-admin.yaml; do
  echo "   Applying $f..."
  kubectl apply -f "$MANIFEST_DIR/$f"
done

# Backend services
for f in 20-api-gateway.yaml 21-backend-services.yaml 22-ml-recommendation-svc.yaml; do
  echo "   Applying $f..."
  kubectl apply -f "$MANIFEST_DIR/$f"
done

echo ""

# -----------------------------------------------
# 6. Wait for rollout
# -----------------------------------------------
echo "6. Waiting for deployments to start..."
sleep 10

echo ""
echo "========================================="
echo "  Deployment Status"
echo "========================================="
kubectl get pods -n skillancer -o wide
echo ""
kubectl get svc -n skillancer
echo ""
echo "========================================="
echo "  Deployment complete!"
echo "========================================="
