---
name: team-builder
description: "Build a balanced competitive Pokemon team around a core Pokemon."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [pokemon, team, competitive, mcp, gaming]
---

# Team Builder — Pokemon MCP Prompt

When this skill is invoked, the user wants a competitive Pokemon team built around a core Pokemon.

## Usage
/team-builder <corePokemon> [tier]

## Instructions

Extract the arguments from the user's command:
- First word after the command = corePokemon
- Second word (optional) = tier (e.g. "OU", "UU", "Ubers", "LC")

Then call the MCP prompt tool: mcp_mcp_pokemon_get_prompt
with name="team-builder" and arguments:
  - corePokemon: (the core pokemon name)
  - tier: (if provided, otherwise omit — default is OU)

Present the full team composition with analysis of type coverage and synergy.

## Example
/team-builder garchomp
/team-builder toxapex OU
/team-builder kyogre Ubers
