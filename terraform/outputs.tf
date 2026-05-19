output "alb_dns_name" {
  description = "DNS público del ALB."
  value       = aws_lb.this.dns_name
}

output "mcp_endpoint" {
  description = "Endpoint MCP para clientes (Claude Desktop, Hermes, test client)."
  value       = "http://${aws_lb.this.dns_name}/mcp"
}

output "health_url" {
  description = "URL de healthcheck."
  value       = "http://${aws_lb.this.dns_name}/health"
}

output "ecr_repository_url" {
  description = "URL del repositorio ECR donde se sube la imagen."
  value       = aws_ecr_repository.this.repository_url
}

output "mcp_api_key_secret" {
  description = "Nombre del secret en Secrets Manager con MCP_API_KEY."
  value       = aws_secretsmanager_secret.mcp_api_key.name
}

output "get_api_key_command" {
  description = "Comando para leer la API key generada."
  value       = "aws secretsmanager get-secret-value --secret-id ${aws_secretsmanager_secret.mcp_api_key.name} --query SecretString --output text --region ${var.region}"
}

output "docker_push_commands" {
  description = "Pasos para construir y subir la imagen a ECR."
  value = join("\n", [
    "aws ecr get-login-password --region ${var.region} | docker login --username AWS --password-stdin ${split("/", aws_ecr_repository.this.repository_url)[0]}",
    "docker build -t ${var.project_name} ..",
    "docker tag ${var.project_name}:latest ${aws_ecr_repository.this.repository_url}:${var.image_tag}",
    "docker push ${aws_ecr_repository.this.repository_url}:${var.image_tag}",
  ])
}
