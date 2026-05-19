---
name: battle-analysis
description: "Analyze a Pokemon battle between two Pokemon: types, stats, and strategy."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [pokemon, battle, mcp, gaming]
---

# Battle Analysis — Pokemon MCP Prompt

When this skill is invoked, the user wants a battle analysis between two Pokemon.

## Usage
/battle-analysis <pokemon1> <pokemon2> [format]

## Instructions

Extract the arguments from the user's command:
- First word after the command = pokemon1
- Second word = pokemon2
- Third word (optional) = battle format (e.g. "singles", "doubles", "OU")

Then call the MCP prompt tool: mcp_mcp_pokemon_get_prompt
with name="battle-analysis" and arguments:
  - pokemon1: (first pokemon name)
  - pokemon2: (second pokemon name)
  - format: (if provided, otherwise omit)

Present the full analysis returned by the prompt.

## Example
/battle-analysis pikachu charizard
/battle-analysis mewtwo garchomp doubles
