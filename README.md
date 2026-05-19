# pokemon-mcp-server

Servidor **MCP** (Model Context Protocol) en TypeScript que expone [PokeAPI](https://pokeapi.co/)
como **tools**, **resources** y **prompts**, usando el transporte moderno **Streamable HTTP**.

## Stack

- TypeScript + Express
- `@modelcontextprotocol/sdk` (SDK oficial de Anthropic)
- `zod` para validación de schemas
- PokeAPI (`https://pokeapi.co/api/v2`) — pública, sin auth

## Endpoints

| Método | Ruta      | Descripción                                    |
|--------|-----------|------------------------------------------------|
| POST   | `/mcp`    | Requests JSON-RPC (initialize + llamadas)      |
| DELETE | `/mcp`    | Cierra una sesión                              |
| GET    | `/health` | Healthcheck (incluye `activeSessions`)         |

Autenticación: header `x-api-key` en todas las rutas excepto `/health`
(clave en `MCP_API_KEY`, fallback `dev-secret-key`).

## Capacidades

- **5 Tools**: `get_pokemon`, `get_move`, `get_type_relations`, `get_evolution_chain`, `list_pokemon`
- **4 Resources**: `pokedex://type-chart`, `mcp://server-info` (estáticos) + `pokemon://{name}`, `type://{name}` (templates)
- **3 Prompts**: `battle-analysis`, `pokedex-entry`, `team-builder`

## Estructura

```
src/
├── index.ts            ← Entry point: Express + gestión de sesiones
├── api/pokeapi.ts      ← Cliente tipado de PokeAPI (no sabe de MCP)
├── middleware/auth.ts  ← Validación x-api-key
├── tools/index.ts      ← Registro de tools
├── resources/index.ts  ← Registro de resources
└── prompts/index.ts    ← Registro de prompts
test/client.mjs         ← Cliente de prueba ESM
```

## Correr el proyecto

```bash
npm install
cp .env.example .env
npm run dev

# En otra terminal
node test/client.mjs
```

> Nota: en entornos con poca memoria (WSL), compilar con
> `NODE_OPTIONS=--max-old-space-size=4096 npm run build`.

## Docker

```bash
docker build -t pokemon-mcp-server .
docker run -p 8000:8000 -e MCP_API_KEY=dev-secret-key pokemon-mcp-server
```

## Conectar desde Claude Desktop

```jsonc
// claude_desktop_config.json
{
  "mcpServers": {
    "pokemon": {
      "type": "http",
      "url": "http://localhost:8000/mcp",
      "headers": { "x-api-key": "dev-secret-key" }
    }
  }
}
```
