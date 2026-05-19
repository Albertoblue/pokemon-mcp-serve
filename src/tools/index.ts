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

  // ── Tool 6: calculate_damage ─────────────────────────────────────────────
  // Tool calculada: orquesta varias llamadas a PokeAPI y devuelve un daño
  // estimado combinando stats, STAB y efectividad de tipo.
  tool(
    server,
    "calculate_damage",
    "Estimate the damage of a move from one Pokémon against another. " +
      "Combines base stats, STAB and type effectiveness. Useful for matchup analysis.",
    {
      attacker: z.string().describe("Attacker Pokémon name or dex number"),
      defender: z.string().describe("Defender Pokémon name or dex number"),
      move: z.string().describe("Move name, e.g. 'thunderbolt', 'earthquake'"),
      level: z
        .number()
        .min(1)
        .max(100)
        .default(50)
        .describe("Attacker level (1-100, default 50)"),
    },
    async ({
      attacker,
      defender,
      move,
      level,
    }: {
      attacker: string;
      defender: string;
      move: string;
      level: number;
    }) => {
      const [att, def, mv] = await Promise.all([
        getPokemon(attacker),
        getPokemon(defender),
        getMove(move),
      ]);

      // Movimientos de estado: sin daño directo
      if (mv.damage_class === "status" || mv.power == null) {
        return {
          content: [
            {
              type: "text" as const,
              text: [
                `# ${mv.name.toUpperCase()} (status)`,
                ``,
                `${mv.name} es un movimiento de tipo ${mv.damage_class} sin daño directo.`,
                ``,
                `**Efecto:** ${mv.effect}`,
              ].join("\n"),
            },
          ],
        };
      }

      // Efectividad combinada contra los tipos del defensor
      const defRelations = await Promise.all(
        def.types.map((t) => getTypeRelations(t.name))
      );
      let effectiveness = 1;
      for (const r of defRelations) {
        if (r.double_damage_from.includes(mv.type)) effectiveness *= 2;
        if (r.half_damage_from.includes(mv.type)) effectiveness *= 0.5;
        if (r.no_damage_from.includes(mv.type)) effectiveness *= 0;
      }

      // STAB: 1.5× si el tipo del movimiento coincide con un tipo del atacante
      const stab = att.types.some((t) => t.name === mv.type) ? 1.5 : 1;

      // Stats relevantes según damage class (physical/special)
      const isSpecial = mv.damage_class === "special";
      const attStatName = isSpecial ? "special-attack" : "attack";
      const defStatName = isSpecial ? "special-defense" : "defense";
      const A = att.stats.find((s) => s.name === attStatName)?.base_stat ?? 50;
      const D = def.stats.find((s) => s.name === defStatName)?.base_stat ?? 50;
      const HP = def.stats.find((s) => s.name === "hp")?.base_stat ?? 100;

      // Fórmula simplificada Gen V+ (sin IVs/EVs/naturaleza/rolls)
      const base = ((2 * level) / 5 + 2) * mv.power * (A / D) / 50 + 2;
      const damage = Math.max(0, base * stab * effectiveness);
      const hpPct = HP > 0 ? (damage / HP) * 100 : 0;

      const effLabel =
        effectiveness === 0
          ? "no afecta (0×)"
          : effectiveness >= 4
          ? `super efectivo (${effectiveness}×)`
          : effectiveness >= 2
          ? `efectivo (${effectiveness}×)`
          : effectiveness === 1
          ? "neutro (1×)"
          : `poco efectivo (${effectiveness}×)`;

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `# ${mv.name.toUpperCase()}: ${att.name} → ${def.name}`,
              ``,
              `**Tipo del movimiento:** ${mv.type} (${mv.damage_class})  |  **Power:** ${mv.power}`,
              `**Nivel del atacante:** ${level}`,
              `**Stat usado:** ${attStatName} = ${A}  vs  ${defStatName} = ${D}`,
              `**STAB:** ${stab}× ${stab > 1 ? "(coincide con tipo del atacante)" : "(sin bonus)"}`,
              `**Efectividad:** ${effLabel}`,
              ``,
              `## Daño estimado`,
              `**${Math.round(damage)} HP** (~${hpPct.toFixed(1)}% del HP base ${HP} del defensor)`,
              ``,
              `> Cálculo simplificado (Gen V+, sin IVs/EVs/naturaleza ni rolls aleatorios). Útil para comparar matchups, no para predecir batallas exactas.`,
            ].join("\n"),
          },
        ],
      };
    }
  );

  // ── Tool 7: suggest_counters ─────────────────────────────────────────────
  // Tool calculada: dado un objetivo y una lista de candidatos, devuelve el
  // top N ordenado por ventaja ofensiva y resistencia defensiva.
  tool(
    server,
    "suggest_counters",
    "Rank the best counter Pokémon against a target from a list of candidates. " +
      "Combines offensive type advantage and defensive resilience against the target's types.",
    {
      target: z.string().describe("Target Pokémon name or dex number"),
      candidates: z
        .array(z.string())
        .min(2)
        .max(20)
        .describe("List of candidate Pokémon names/ids to evaluate (2–20)"),
      limit: z
        .number()
        .min(1)
        .max(10)
        .default(3)
        .describe("Number of top counters to return (default 3)"),
    },
    async ({
      target,
      candidates,
      limit,
    }: {
      target: string;
      candidates: string[];
      limit: number;
    }) => {
      const tgt = await getPokemon(target);
      const tgtTypes = tgt.types.map((t) => t.name);
      const tgtRelations = await Promise.all(
        tgtTypes.map((t) => getTypeRelations(t))
      );

      type Scored = {
        name: string;
        types: string[];
        offense: number;
        defense: number;
        score: number;
        error?: string;
      };

      const results: Scored[] = await Promise.all(
        candidates.map(async (name): Promise<Scored> => {
          try {
            const p = await getPokemon(name);
            const pTypes = p.types.map((t) => t.name);
            const pRelations = await Promise.all(
              pTypes.map((t) => getTypeRelations(t))
            );

            // Ofensiva: mejor multiplicador de alguno de los tipos del candidato
            // contra la combinación de tipos del objetivo.
            let bestOffense = 0;
            for (const pt of pTypes) {
              let mult = 1;
              for (const rel of tgtRelations) {
                if (rel.double_damage_from.includes(pt)) mult *= 2;
                if (rel.half_damage_from.includes(pt)) mult *= 0.5;
                if (rel.no_damage_from.includes(pt)) mult *= 0;
              }
              if (mult > bestOffense) bestOffense = mult;
            }

            // Defensiva: peor caso recibiendo STAB de alguno de los tipos del objetivo.
            let worstDefense = 1;
            for (const tt of tgtTypes) {
              let m = 1;
              for (const rel of pRelations) {
                if (rel.double_damage_from.includes(tt)) m *= 2;
                if (rel.half_damage_from.includes(tt)) m *= 0.5;
                if (rel.no_damage_from.includes(tt)) m *= 0;
              }
              if (m > worstDefense) worstDefense = m;
            }

            // Score: ofensiva premia (×1), defensiva penaliza el exceso (>1).
            const score = bestOffense - (worstDefense - 1);

            return {
              name: p.name,
              types: pTypes,
              offense: bestOffense,
              defense: worstDefense,
              score,
            };
          } catch (e: any) {
            return {
              name,
              types: [],
              offense: 0,
              defense: 0,
              score: -Infinity,
              error: e?.message ?? "fetch error",
            };
          }
        })
      );

      const ranked = results
        .filter((r) => !r.error)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      const failed = results.filter((r) => r.error);

      const lines: string[] = [
        `# Top counters vs ${tgt.name} (${tgtTypes.join("/")})`,
        ``,
        `Evaluados ${results.length} candidatos. Ranking por ventaja ofensiva (mejor tipo del candidato vs tipos del objetivo) y resistencia defensiva (peor caso recibiendo STAB del objetivo).`,
        ``,
      ];

      ranked.forEach((r, i) => {
        const label =
          r.offense >= 2 && r.defense <= 1
            ? "Excelente"
            : r.offense >= 2
            ? "Ofensivo"
            : r.defense <= 0.5
            ? "Resistente"
            : "Aceptable";
        lines.push(
          `**${i + 1}. ${r.name}** (${r.types.join("/")}) — ${label}`
        );
        lines.push(`   · Ofensiva: ${r.offense}× contra ${tgtTypes.join("/")}`);
        lines.push(`   · Defensiva: ${r.defense}× recibiendo STAB del objetivo`);
        lines.push(``);
      });

      if (failed.length > 0) {
        lines.push(`> ⚠ No se pudieron evaluar: ${failed.map((f) => f.name).join(", ")}`);
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  // ── Tool 8: type_coverage ────────────────────────────────────────────────
  // Tool calculada: analiza un equipo y detecta debilidades compartidas
  // (defensivas) y tipos que ningún miembro puede golpear super eficaz.
  tool(
    server,
    "type_coverage",
    "Analyze a team's defensive weaknesses and offensive type coverage based on members' types. " +
      "Returns shared weaknesses (multiple members weak to the same type) and uncovered types offensively.",
    {
      team: z
        .array(z.string())
        .min(2)
        .max(6)
        .describe("Team members (Pokémon names or dex numbers, 2–6)"),
    },
    async ({ team }: { team: string[] }) => {
      const ALL_TYPES = [
        "normal", "fire", "water", "electric", "grass", "ice",
        "fighting", "poison", "ground", "flying", "psychic",
        "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy",
      ];

      const pokes = await Promise.all(team.map((n) => getPokemon(n)));

      // Para cada miembro: relaciones de cada uno de sus tipos
      const memberRelations = await Promise.all(
        pokes.map((p) => Promise.all(p.types.map((t) => getTypeRelations(t.name))))
      );

      // Defensivo: por cada tipo atacante, cuántos miembros lo sufren 2× o más
      const weaknessCount: Record<string, number> = {};
      pokes.forEach((p, i) => {
        const rels = memberRelations[i];
        for (const t of ALL_TYPES) {
          let mult = 1;
          for (const r of rels) {
            if (r.double_damage_from.includes(t)) mult *= 2;
            if (r.half_damage_from.includes(t)) mult *= 0.5;
            if (r.no_damage_from.includes(t)) mult *= 0;
          }
          if (mult > 1) weaknessCount[t] = (weaknessCount[t] ?? 0) + 1;
        }
      });

      // Ofensivo (STAB): tipos únicos del equipo y qué pueden golpear 2×
      const teamTypes = new Set<string>();
      pokes.forEach((p) => p.types.forEach((t) => teamTypes.add(t.name)));
      const offRelations = await Promise.all([...teamTypes].map((t) => getTypeRelations(t)));
      const canHitSuper = new Set<string>();
      offRelations.forEach((r) => r.double_damage_to.forEach((t) => canHitSuper.add(t)));
      const uncovered = ALL_TYPES.filter((t) => !canHitSuper.has(t));

      const sharedWeakness = Object.entries(weaknessCount)
        .filter(([, n]) => n >= 2)
        .sort((a, b) => b[1] - a[1])
        .map(([t, n]) => `**${t}** (${n}/${team.length} miembros)`);

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `# Cobertura del equipo`,
              ``,
              `**Miembros:** ${pokes.map((p) => `${p.name} (${p.types.map((t) => t.name).join("/")})`).join(", ")}`,
              ``,
              `## Debilidades compartidas (defensivas)`,
              sharedWeakness.length > 0
                ? sharedWeakness.map((w) => `- ${w}`).join("\n")
                : "Ninguna — buen reparto defensivo.",
              ``,
              `## Cobertura ofensiva (basada en STAB)`,
              `**Tipos que el equipo PUEDE golpear super eficaz:** ${[...canHitSuper].sort().join(", ") || "ninguno"}`,
              `**Tipos sin cobertura ofensiva:** ${uncovered.join(", ") || "todos cubiertos"}`,
              ``,
              `> Cobertura calculada solo desde los tipos de cada miembro (STAB). Para análisis preciso, considera también los movesets reales.`,
            ].join("\n"),
          },
        ],
      };
    }
  );
}
