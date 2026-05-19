---
name: pokedex-entry
description: "Generate a creative in-universe Pokedex entry for a Pokemon."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [pokemon, pokedex, mcp, gaming]
---

# Pokedex Entry — Pokemon MCP Prompt

When this skill is invoked, the user wants a creative Pokedex entry for a Pokemon.

## Usage
/pokedex-entry <pokemonName> [style]

## Instructions

Extract the arguments from the user's command:
- First word after the command = pokemonName
- Second word (optional) = style: "classic" (Gen 1 feel), "scarlet", or "violet"

Then call the MCP prompt tool: mcp_mcp_pokemon_get_prompt
with name="pokedex-entry" and arguments:
  - pokemonName: (pokemon name)
  - style: (if provided, otherwise omit)

Present the Pokedex entry returned by the prompt, in an immersive in-universe style.

## Example
/pokedex-entry gengar
/pokedex-entry eevee scarlet
/pokedex-entry bulbasaur classic
