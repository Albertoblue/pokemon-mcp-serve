/**
 * MCP Tools
 *
 * Tools are functions the LLM/agent can INVOKE to take actions or fetch data.
 * Each tool has:
 *   - name          → unique identifier
 *   - description   → tells the LLM when and how to use it
 *   - inputSchema   → Zod shape for the parameters (validated automatically)
 *   - handler       → the actual implementation
 *
 * Registered on: McpServer via the local tool() helper, which wraps
 * server.registerTool() and collapses the SDK's deep generic inference
 * (otherwise tsc raises TS2589 — "type instantiation excessively deep").
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z, ZodRawShape } from "zod";
import {
  getPokemon,
  getMove,
  getTypeRelations,
  getEvolutionChain,
  listPokemon,
} from "../api/pokeapi";

/**
 * Thin wrapper around server.registerTool().
 *
 * The SDK's generic `registerTool<InputArgs>` deeply instantiates the Zod
 * shape into the callback type, which makes `tsc` raise TS2589. Casting at
 * this single boundary collapses that inference while keeping the public
 * registration typed. Handlers receive their args explicitly typed instead.
 */
function tool(
  server: McpServer,
  name: string,
  description: string,
  inputSchema: ZodRawShape,
  handler: (args: any) => Promise<{ content: { type: "text"; text: string }[] }>
): void {
  server.registerTool(name, { description, inputSchema } as any, handler as any);
}

export function registerTools(server: McpServer): void {
  // ── Tool 1: get_pokemon ──────────────────────────────────────────────────
  tool(
    server,
    "get_pokemon",
    "Fetch full details of a Pokémon by name or Pokédex number. " +
      "Returns stats, types, abilities, height, weight, and sprite URL.",
    {
      nameOrId: z
        .union([z.string(), z.number()])
        .describe(
          "Pokémon name (e.g. 'pikachu') or national dex number (e.g. 25)"
        ),
    },
    async ({ nameOrId }: { nameOrId: string | number }) => {
      const pokemon = await getPokemon(nameOrId);

      const statsFormatted = pokemon.stats
        .map((s) => `  ${s.name}: ${s.base_stat}`)
        .join("\n");

      const abilitiesFormatted = pokemon.abilities
        .map((a) => `  ${a.name}${a.is_hidden ? " (hidden)" : ""}`)
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `# ${pokemon.name.toUpperCase()} (#${pokemon.id})`,
              ``,
              `**Types:** ${pokemon.types.map((t) => t.name).join(", ")}`,
              `**Height:** ${pokemon.height / 10}m  |  **Weight:** ${pokemon.weight / 10}kg`,
              `**Base Experience:** ${pokemon.base_experience}`,
              ``,
              `**Base Stats:**`,
              statsFormatted,
              ``,
              `**Abilities:**`,
              abilitiesFormatted,
              ``,
              pokemon.sprite ? `**Sprite:** ${pokemon.sprite}` : "",
            ]
              .filter((l) => l !== undefined)
              .join("\n"),
          },
        ],
      };
    }
  );

  // ── Tool 2: get_move ─────────────────────────────────────────────────────
  tool(
    server,
    "get_move",
    "Fetch details of a Pokémon move by name. " +
      "Returns type, power, accuracy, PP, damage class and effect description.",
    {
      name: z
        .string()
        .describe("Move name, e.g. 'thunderbolt', 'flamethrower'"),
    },
    async ({ name }: { name: string }) => {
      const move = await getMove(name);
      return {
        content: [
          {
            type: "text" as const,
            text: [
              `# Move: ${move.name.toUpperCase()}`,
              ``,
              `**Type:** ${move.type}  |  **Class:** ${move.damage_class}`,
              `**Power:** ${move.power ?? "—"}  |  **Accuracy:** ${move.accuracy ?? "—"}%  |  **PP:** ${move.pp}`,
              ``,
              `**Effect:** ${move.effect}`,
            ].join("\n"),
          },
        ],
      };
    }
  );

  // ── Tool 3: get_type_relations ───────────────────────────────────────────
  tool(
    server,
    "get_type_relations",
    "Get the damage relations (strengths and weaknesses) of a Pokémon type. " +
      "Useful for battle strategy: know what a type is weak or resistant to.",
    {
      typeName: z
        .string()
        .describe("Type name, e.g. 'fire', 'water', 'dragon', 'ghost'"),
    },
    async ({ typeName }: { typeName: string }) => {
      const relations = await getTypeRelations(typeName);
      return {
        content: [
          {
            type: "text" as const,
            text: [
              `# Type: ${relations.name.toUpperCase()}`,
              ``,
              `## Offensive`,
              `**Super effective against (2×):** ${relations.double_damage_to.join(", ") || "none"}`,
              `**Not very effective against (½×):** ${relations.half_damage_to.join(", ") || "none"}`,
              `**No effect against (0×):** ${relations.no_damage_to.join(", ") || "none"}`,
              ``,
              `## Defensive`,
              `**Weak to (2×):** ${relations.double_damage_from.join(", ") || "none"}`,
              `**Resistant to (½×):** ${relations.half_damage_from.join(", ") || "none"}`,
              `**Immune to (0×):** ${relations.no_damage_from.join(", ") || "none"}`,
            ].join("\n"),
          },
        ],
      };
    }
  );

  // ── Tool 4: get_evolution_chain ──────────────────────────────────────────
  tool(
    server,
    "get_evolution_chain",
    "Get the full evolution chain for a Pokémon species. " +
      "Returns each stage with the trigger and minimum level required.",
    {
      pokemonName: z
        .string()
        .describe("Pokémon species name, e.g. 'charmander', 'eevee'"),
    },
    async ({ pokemonName }: { pokemonName: string }) => {
      const chain = await getEvolutionChain(pokemonName);
      const stages = chain.stages
        .map((s, i) => {
          const indent = "  ".repeat(i);
          const trigger =
            s.trigger === "base"
              ? "(base form)"
              : s.min_level
              ? `→ level ${s.min_level} (${s.trigger})`
              : `→ ${s.trigger}`;
          return `${indent}${s.species} ${trigger}`;
        })
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: [`# Evolution Chain for ${pokemonName}`, ``, stages].join(
              "\n"
            ),
          },
        ],
      };
    }
  );

  // ── Tool 5: list_pokemon ─────────────────────────────────────────────────
  tool(
    server,
    "list_pokemon",
    "List Pokémon from the Pokédex with pagination. Returns name and ID.",
    {
      limit: z
        .number()
        .min(1)
        .max(100)
        .default(20)
        .describe("Number of results to return (max 100)"),
      offset: z
        .number()
        .min(0)
        .default(0)
        .describe("Number of Pokémon to skip (for pagination)"),
    },
    async ({ limit, offset }: { limit: number; offset: number }) => {
      const list = await listPokemon(limit, offset);
      const formatted = list
        .map((p) => `#${String(p.id).padStart(3, "0")} ${p.name}`)
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `# Pokédex (offset: ${offset}, limit: ${limit})`,
              ``,
              formatted,
            ].join("\n"),
          },
        ],
      };
    }
  );
}
