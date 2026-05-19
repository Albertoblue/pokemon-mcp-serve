#!/usr/bin/env bash
# Despliegue completo: infra base -> push de imagen -> servicio.
# Uso: cd terraform && ./deploy.sh
set -euo pipefail

cd "$(dirname "$0")"

echo "==> 1/4  terraform init"
terraform init -input=false

echo "==> 2/4  Crear ECR + red + secret (sin el servicio todavía)"
terraform apply -input=false -auto-approve \
  -target=aws_ecr_repository.this \
  -target=aws_secretsmanager_secret_version.mcp_api_key

ECR_URL=$(terraform output -raw ecr_repository_url)
REGION=$(terraform output -raw mcp_api_key_secret >/dev/null 2>&1; echo "${AWS_REGION:-us-east-1}")
REGISTRY="${ECR_URL%%/*}"

echo "==> 3/4  Build y push de la imagen a ${ECR_URL}:latest"
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"
docker build -t pokemon-mcp-server ..
docker tag pokemon-mcp-server:latest "${ECR_URL}:latest"
docker push "${ECR_URL}:latest"

echo "==> 4/4  Desplegar el resto (ALB + ECS service)"
terraform apply -input=false -auto-approve

echo
echo "Listo. Endpoints:"
terraform output mcp_endpoint
terraform output health_url
echo "API key:"
terraform output -raw get_api_key_command
echo
