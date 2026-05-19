/**
 * MCP Resources
 *
 * Resources are READ-ONLY data sources the LLM can inspect.
 * Think of them as "files" or "pages" the agent can open.
 * Unlike Tools, Resources are NOT called with arguments —
 * they have a fixed URI the client can subscribe to or read.
 *
 * Two types:
 *   - Static resource  → fixed URI, fixed content
 *   - Resource template → URI with parameters, e.g. pokemon://{name}
 *
 * Registered on: McpServer via server.registerResource() (modern SDK API).
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getPokemon, getTypeRelations } from "../api/pokeapi";

// All 18 canonical Pokémon types
const ALL_TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice",
  "fighting", "poison", "ground", "flying", "psychic",
  "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy",
];

export function registerResources(server: McpServer): void {
  // ── Resource 1: Static — Pokédex Type Chart ───────────────────────────────
  // A static resource: always the same URI, always the same content.
  server.registerResource(
    "type-chart",
    "pokedex://type-chart",
    {
      description:
        "Complete list of all 18 Pokémon types. " +
        "Use this as a reference before querying type relations.",
      mimeType: "text/plain",
    },
    async () => ({
      contents: [
        {
          uri: "pokedex://type-chart",
          mimeType: "text/plain",
          text: [
            "# All Pokémon Types",
            "",
            "Use get_type_relations tool with any of these names:",
            "",
            ALL_TYPES.map((t, i) => `${String(i + 1).padStart(2, " ")}. ${t}`).join("\n"),
          ].join("\n"),
        },
      ],
    })
  );

  // ── Resource 2: Static — Server Info ─────────────────────────────────────
  server.registerResource(
    "server-info",
    "mcp://server-info",
    {
      description:
        "Metadata about this MCP server: available tools, resources, and prompts.",
      mimeType: "application/json",
    },
    async () => ({
      contents: [
        {
          uri: "mcp://server-info",
          mimeType: "application/json",
          text: JSON.stringify(
            {
              name: "pokemon-mcp-server",
              version: "1.0.0",
              api: "https://pokeapi.co/api/v2",
              tools: [
                "get_pokemon",
                "get_move",
                "get_type_relations",
                "get_evolution_chain",
                "list_pokemon",
              ],
              resources: [
                "pokedex://type-chart",
                "mcp://server-info",
                "pokemon://{name}  (template)",
                "type://{name}     (template)",
              ],
              prompts: ["battle-analysis", "pokedex-entry", "team-builder"],
            },
            null,
            2
          ),
        },
      ],
    })
  );

  // ── Resource 3: Template — Pokémon profile ────────────────────────────────
  // A resource template lets clients read dynamic URIs like pokemon://pikachu.
  // The {name} part is extracted and passed to the handler.
  server.registerResource(
    "pokemon-profile",
    new ResourceTemplate("pokemon://{name}", { list: undefined }),
    {
      description:
        "Full profile of a Pokémon at pokemon://{name}. Example: pokemon://charizard",
      mimeType: "text/plain",
    },
    async (uri, { name }) => {
      const pokemonName = Array.isArray(name) ? name[0] : name;
      const p = await getPokemon(pokemonName);
      const statTotal = p.stats.reduce((sum, s) => sum + s.base_stat, 0);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text: [
              `═══════════════════════════════`,
              `  ${p.name.toUpperCase()} — #${p.id}`,
              `═══════════════════════════════`,
              `Type:    ${p.types.map((t) => t.name).join(" / ")}`,
              `Height:  ${p.height / 10}m`,
              `Weight:  ${p.weight / 10}kg`,
              `Exp:     ${p.base_experience}`,
              ``,
              `── Stats (Total: ${statTotal}) ──`,
              ...p.stats.map((s) => {
                const bar = "█".repeat(Math.round(s.base_stat / 10));
                return `${s.name.padEnd(16)} ${String(s.base_stat).padStart(3)} ${bar}`;
              }),
              ``,
              `── Abilities ──`,
              ...p.abilities.map(
                (a) => `• ${a.name}${a.is_hidden ? " [hidden]" : ""}`
              ),
            ].join("\n"),
          },
        ],
      };
    }
  );

  // ── Resource 4: Template — Type detail ───────────────────────────────────
  server.registerResource(
    "type-detail",
    new ResourceTemplate("type://{name}", { list: undefined }),
    {
      description:
        "Damage relations for a type at type://{name}. Example: type://dragon",
      mimeType: "text/plain",
    },
    async (uri, { name }) => {
      const typeName = Array.isArray(name) ? name[0] : name;
      const rel = await getTypeRelations(typeName);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text: [
              `Type: ${rel.name.toUpperCase()}`,
              ``,
              `Offensive`,
              `  2× to:  ${rel.double_damage_to.join(", ") || "—"}`,
              `  ½× to:  ${rel.half_damage_to.join(", ") || "—"}`,
              `  0× to:  ${rel.no_damage_to.join(", ") || "—"}`,
              ``,
              `Defensive`,
              `  Weak (2×):    ${rel.double_damage_from.join(", ") || "—"}`,
              `  Resists (½×): ${rel.half_damage_from.join(", ") || "—"}`,
              `  Immune (0×):  ${rel.no_damage_from.join(", ") || "—"}`,
            ].join("\n"),
          },
        ],
      };
    }
  );
}
