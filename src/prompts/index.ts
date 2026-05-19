/**
 * MCP Prompts
 *
 * Prompts are REUSABLE message templates the client (or LLM) can request.
 * They can accept arguments to produce dynamic system/user messages.
 *
 * Key difference from Tools:
 *   - Tools   → agent calls them to DO something (fetch data, run code)
 *   - Prompts → client requests a pre-built conversation template
 *               to GUIDE the LLM toward a specific task or persona
 *
 * Registered on: McpServer via the local prompt() helper, which wraps
 * server.registerPrompt() and collapses the SDK's deep generic inference
 * (otherwise tsc raises TS2589 — "type instantiation excessively deep").
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z, ZodRawShape } from "zod";

interface PromptResult {
  messages: {
    role: "user";
    content: { type: "text"; text: string };
  }[];
}

/**
 * Thin wrapper around server.registerPrompt(). See tools/index.ts for the
 * rationale: casting at this single boundary avoids the SDK's TS2589 blowup.
 */
function prompt(
  server: McpServer,
  name: string,
  description: string,
  argsSchema: ZodRawShape,
  handler: (args: any) => PromptResult
): void {
  server.registerPrompt(
    name,
    { description, argsSchema } as any,
    handler as any
  );
}

export function registerPrompts(server: McpServer): void {
  // ── Prompt 1: battle-analysis ─────────────────────────────────────────────
  // Guides the LLM to analyze a matchup between two Pokémon.
  prompt(
    server,
    "battle-analysis",
    "Generate a battle analysis prompt for two Pokémon. " +
      "The LLM will compare types, stats, and suggest a strategy.",
    {
      pokemon1: z.string().describe("First Pokémon name"),
      pokemon2: z.string().describe("Second Pokémon name"),
      format: z
        .enum(["singles", "doubles"])
        .default("singles")
        .describe("Battle format"),
    },
    ({
      pokemon1,
      pokemon2,
      format,
    }: {
      pokemon1: string;
      pokemon2: string;
      format: string;
    }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `You are an expert Pokémon battle strategist.`,
              ``,
              `Analyze the ${format} battle matchup between **${pokemon1}** and **${pokemon2}**.`,
              ``,
              `To complete your analysis:`,
              `1. Use the get_pokemon tool to fetch data for both Pokémon`,
              `2. Use get_type_relations to understand type advantages`,
              `3. Compare their base stats (focus on Speed, Attack/Sp.Atk, HP)`,
              ``,
              `Provide:`,
              `- Type matchup advantage`,
              `- Stat comparison summary`,
              `- Which Pokémon has the edge and why`,
              `- A recommended winning strategy for each side`,
            ].join("\n"),
          },
        },
      ],
    })
  );

  // ── Prompt 2: pokedex-entry ───────────────────────────────────────────────
  // Generates a creative, in-universe Pokédex entry in the style of the games.
  prompt(
    server,
    "pokedex-entry",
    "Generate a creative in-universe Pokédex entry for a Pokémon, " +
      "in the style of official Pokémon game entries.",
    {
      pokemonName: z.string().describe("Pokémon name"),
      style: z
        .enum(["classic", "scarlet", "violet"])
        .default("classic")
        .describe(
          "Pokédex book style — classic (Gen 1 feel), scarlet, or violet"
        ),
    },
    ({
      pokemonName,
      style,
    }: {
      pokemonName: string;
      style: "classic" | "scarlet" | "violet";
    }) => {
      const styleDesc =
        style === "classic"
          ? "Use a factual, scientific tone reminiscent of the original Game Boy games."
          : style === "scarlet"
          ? "Use an ancient, historical tone — as if describing legends from the past."
          : "Use a biological/ecological tone — focusing on the Pokémon's observed behaviors.";

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                `You are writing the official Pokédex entry for ${pokemonName}.`,
                ``,
                `Style: ${style.toUpperCase()} — ${styleDesc}`,
                ``,
                `First, use the get_pokemon tool to fetch ${pokemonName}'s stats and types.`,
                `Then write a 2-3 sentence Pokédex entry that:`,
                `- Sounds authentic to the Pokémon universe`,
                `- References the Pokémon's type, abilities, or physical characteristics`,
                `- Ends with one mysterious or surprising fact`,
                ``,
                `Keep it under 60 words. Do not mention game mechanics (stats, HP, etc.).`,
              ].join("\n"),
            },
          },
        ],
      };
    }
  );

  // ── Prompt 3: team-builder ────────────────────────────────────────────────
  // Asks the LLM to suggest a balanced competitive team around a core Pokémon.
  prompt(
    server,
    "team-builder",
    "Build a balanced competitive Pokémon team around a core Pokémon. " +
      "The LLM will analyze type coverage and suggest 5 complementary partners.",
    {
      corePokemon: z
        .string()
        .describe("The main Pokémon to build the team around"),
      tier: z
        .enum(["OU", "UU", "NU", "Ubers", "Little Cup"])
        .default("OU")
        .describe("Competitive tier (OU = standard)"),
    },
    ({ corePokemon, tier }: { corePokemon: string; tier: string }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `You are a competitive Pokémon team builder.`,
              ``,
              `Build a balanced ${tier} team centered around **${corePokemon}**.`,
              ``,
              `Steps to follow:`,
              `1. Use get_pokemon to analyze ${corePokemon}'s types and stats`,
              `2. Use get_type_relations on each of ${corePokemon}'s types`,
              `3. Identify the type weaknesses that need team coverage`,
              `4. Suggest 5 partner Pokémon that cover those weaknesses`,
              ``,
              `For each partner provide:`,
              `- Name and role (e.g. "Special Sweeper", "Physical Wall", "Hazard Setter")`,
              `- Why it synergizes with ${corePokemon}`,
              `- One suggested move`,
              ``,
              `Format the output as a clean team sheet.`,
            ].join("\n"),
          },
        },
      ],
    })
  );
}
