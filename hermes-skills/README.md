# Skills de Hermes — pokemon-mcp-server

Skills personalizados para [Hermes Agent](https://hermes-agent.nousresearch.com/docs/)
que usan el servidor MCP `pokemon-mcp-server` de este repo. Cada carpeta contiene
un único `SKILL.md` (Markdown con frontmatter YAML) listo para instalar.

## Skills incluidos

| Carpeta | Skill | Qué hace |
|---|---|---|
| `pokemon-expert/` | `pokemon-expert` | Persona experta que **siempre** consulta el MCP para datos reales (regla de oro: nunca inventar). |
| `battle-analysis/` | `battle-analysis` | Envuelve el prompt MCP `battle-analysis` como comando `/battle-analysis`. |
| `pokedex-entry/` | `pokedex-entry` | Envuelve el prompt MCP `pokedex-entry` como comando `/pokedex-entry`. |
| `team-builder/` | `team-builder` | Envuelve el prompt MCP `team-builder` como comando `/team-builder`. |

## Instalar (en WSL/Linux)

```bash
# Copia cada carpeta a la categoría 'gaming' (o la que prefieras) de Hermes
for s in pokemon-expert battle-analysis pokedex-entry team-builder; do
  mkdir -p ~/.hermes/skills/gaming/$s
  cp $s/SKILL.md ~/.hermes/skills/gaming/$s/
done

# Recarga Hermes
# (dentro del chat)
# /reload-skills
# o reinicia: hermes gateway run
```

## Requisito

Los 4 skills delegan en el servidor MCP `pokemon`. Asegúrate de que esté
configurado en Hermes y accesible (ver lección "Hermes Agent + Telegram"
del curso `ncpDemo/`).

## Formato

Frontmatter YAML real observado en los skills instalados (`name`, `description`,
`tags` planos — no la variante anidada `metadata.hermes` del ejemplo de los docs):

```yaml
---
name: nombre-del-skill
description: "Una línea explicando qué hace."
tags: [gaming, pokemon, mcp, ...]
---

# Título
## When to Use
...
## Procedure / Steps
...
```
