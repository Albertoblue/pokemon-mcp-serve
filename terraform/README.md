# Despliegue en AWS — Terraform

Lleva `pokemon-mcp-server` a **AWS ECS Fargate** detrás de un **Application Load Balancer**.

## Arquitectura

```
Internet ─HTTP:80─▶ ALB ──▶ Target Group (/health)
                              │
                              ▼
                    ECS Fargate Service  (subnets públicas, SG: solo ALB)
                              │  imagen
                              ▼
                            ECR        MCP_API_KEY ◀── Secrets Manager
                              │
                         CloudWatch Logs  (/ecs/pokemon-mcp-server)
```

Recursos creados: VPC (2 subnets públicas, IGW), Security Groups, ECR (+lifecycle),
Secrets Manager (MCP_API_KEY), IAM (execution/task roles), ALB + listener + target group,
ECS cluster + task definition + service, CloudWatch Log Group.

## Requisitos

- Terraform >= 1.5, AWS CLI configurado (`aws configure`), Docker.
- Credenciales con permisos sobre ECS/ECR/EC2/ELB/IAM/SecretsManager/Logs.

## Despliegue rápido

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars   # ajusta si quieres
./deploy.sh
```

`deploy.sh` hace: `init` → crea ECR/red/secret → `docker build` + push de la imagen
→ aplica el resto (ALB + servicio ECS). Es de **dos fases a propósito**: el servicio
ECS no puede arrancar hasta que exista la imagen en ECR.

## Despliegue manual (equivalente)

```bash
terraform init
# 1) Crear primero el repositorio ECR y el secret
terraform apply -target=aws_ecr_repository.this -target=aws_secretsmanager_secret_version.mcp_api_key

# 2) Construir y subir la imagen (ver el output docker_push_commands)
terraform output docker_push_commands

# 3) Desplegar todo
terraform apply
```

## Después del apply

```bash
terraform output mcp_endpoint   # http://<alb>/mcp
terraform output health_url     # http://<alb>/health

# Obtener la API key generada:
aws secretsmanager get-secret-value \
  --secret-id pokemon-mcp-server/mcp-api-key \
  --query SecretString --output text
```

Prueba:

```bash
curl $(terraform output -raw health_url)         # {"status":"ok",...}
KEY=$(aws secretsmanager get-secret-value --secret-id pokemon-mcp-server/mcp-api-key --query SecretString --output text)
node ../test/client.mjs   # con MCP_SERVER_URL=http://<alb>  y MCP_API_KEY=$KEY
```

En Claude Desktop / Hermes, apunta la `url` a `http://<alb>/mcp` y el header
`x-api-key` al valor del secret.

## Actualizar la app (nueva versión)

```bash
docker build -t pokemon-mcp-server ..
docker tag pokemon-mcp-server:latest <ecr_url>:latest
docker push <ecr_url>:latest
aws ecs update-service --cluster pokemon-mcp-server-cluster \
  --service pokemon-mcp-server-svc --force-new-deployment
```

## Destruir

```bash
terraform destroy
```

## Notas / producción

- **HTTPS**: el listener es HTTP:80. Para producción añade un certificado ACM y el
  listener 443 (plantilla comentada en `alb.tf`), y restringe `allowed_cidr`.
- **Subnets públicas + IP pública**: se evita el coste del NAT Gateway. Las tareas no
  son accesibles directamente (SG solo permite tráfico del ALB). Para máxima
  seguridad, usar subnets privadas + NAT (mayor coste).
- **Coste aproximado** (us-east-1, 1 tarea 0.25vCPU/0.5GB): ALB (~$16/mes) +
  Fargate (~$9/mes) + logs. Apaga con `terraform destroy` cuando no lo uses.
- **Estado**: por defecto local. Para equipo, configura el backend S3 en `versions.tf`.
- **Streamable HTTP**: el `idle_timeout` del ALB es 300s (variable) para conexiones
  largas; ajústalo según necesidad.
