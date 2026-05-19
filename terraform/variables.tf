variable "region" {
  description = "Región de AWS donde desplegar."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Nombre base para todos los recursos."
  type        = string
  default     = "pokemon-mcp-server"
}

variable "container_port" {
  description = "Puerto que expone el contenedor (debe coincidir con EXPOSE y app.listen)."
  type        = number
  default     = 8000
}

variable "image_tag" {
  description = "Tag de la imagen en ECR a desplegar."
  type        = string
  default     = "latest"
}

variable "desired_count" {
  description = "Número de tareas Fargate en ejecución."
  type        = number
  default     = 1
}

variable "task_cpu" {
  description = "CPU de la tarea Fargate (256 = 0.25 vCPU)."
  type        = number
  default     = 256
}

variable "task_memory" {
  description = "Memoria de la tarea Fargate en MiB."
  type        = number
  default     = 512
}

variable "mcp_api_key" {
  description = "Valor de MCP_API_KEY. Si se deja vacío, se genera uno aleatorio fuerte."
  type        = string
  default     = ""
  sensitive   = true
}

variable "alb_idle_timeout" {
  description = "Idle timeout del ALB en segundos (conexiones largas / streaming)."
  type        = number
  default     = 300
}

variable "allowed_cidr" {
  description = "CIDR permitido para acceder al ALB (HTTP). Restringe en producción."
  type        = string
  default     = "0.0.0.0/0"
}

variable "log_retention_days" {
  description = "Días de retención de logs en CloudWatch."
  type        = number
  default     = 14
}
