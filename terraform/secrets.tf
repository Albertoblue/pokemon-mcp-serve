# ─────────────────────────────────────────────────────────────────────────────
# MCP_API_KEY en Secrets Manager. Si no se pasa var.mcp_api_key, se genera
# una clave aleatoria fuerte. El contenedor la recibe vía `secrets` (valueFrom),
# nunca se hornea en la imagen ni se ve en el task definition en texto plano.
# ─────────────────────────────────────────────────────────────────────────────

resource "random_password" "api_key" {
  count   = var.mcp_api_key == "" ? 1 : 0
  length  = 48
  special = false
}

locals {
  mcp_api_key = var.mcp_api_key != "" ? var.mcp_api_key : random_password.api_key[0].result
}

resource "aws_secretsmanager_secret" "mcp_api_key" {
  name                    = "${var.project_name}/mcp-api-key"
  description             = "API key (header x-api-key) del servidor MCP"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "mcp_api_key" {
  secret_id     = aws_secretsmanager_secret.mcp_api_key.id
  secret_string = local.mcp_api_key
}
