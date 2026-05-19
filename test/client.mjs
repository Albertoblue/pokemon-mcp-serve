/**
 * MCP Test Client (Streamable HTTP)
 *
 * Pure ESM (no TypeScript). Connects via StreamableHTTPClientTransport to
 * http://localhost:8000/mcp passing the x-api-key header.
 *
 * Exercises every capability in order:
 *   1. listTools / listResources / listPrompts
 *   2. Each tool with a real example argument
 *   3. Each resource (static URIs + templates pokemon://gengar, type://ghost)
 *   4. Each prompt with example arguments
 *
 * Run with: node test/client.mjs   (server must be running: npm run dev)
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const SERVER_URL = process.env.MCP_SERVER_URL ?? "http://localhost:8000";
const API_KEY = process.env.MCP_API_KEY ?? "dev-secret-key";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function section(title) {
  console.log(`\n${"═".repeat(50)}`);
  console.log(`  ${title}`);
  console.log("═".repeat(50));
}

function ok(label, value) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").slice(0, 120) : value;
  console.log(`✅ ${label}: ${text}`);
}

function fail(label, err) {
  console.error(`❌ ${label}: ${err.message}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔌 Connecting to ${SERVER_URL}/mcp`);

  const transport = new StreamableHTTPClientTransport(
    new URL(`${SERVER_URL}/mcp`),
    {
      // API key sent on every HTTP request to the server.
      requestInit: { headers: { "x-api-key": API_KEY } },
    }
  );

  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log("✅ Connected!");

  // ── 1. List capabilities ──────────────────────────────────────────────────
  section("1 · Listing Capabilities");

  const tools = await client.listTools();
  const resources = await client.listResources();
  const prompts = await client.listPrompts();

  console.log(`Tools     (${tools.tools.length}):`, tools.tools.map((t) => t.name).join(", "));
  console.log(`Resources (${resources.resources.length}):`, resources.resources.map((r) => r.name).join(", "));
  console.log(`Prompts   (${prompts.prompts.length}):`, prompts.prompts.map((p) => p.name).join(", "));

  // ── 2. Tools ──────────────────────────────────────────────────────────────
  section("2 · Tools");

  try {
    const r = await client.callTool({ name: "get_pokemon", arguments: { nameOrId: "pikachu" } });
    ok("get_pokemon(pikachu)", r.content[0].text);
  } catch (e) { fail("get_pokemon", e); }

  try {
    const r = await client.callTool({ name: "get_move", arguments: { name: "thunderbolt" } });
    ok("get_move(thunderbolt)", r.content[0].text);
  } catch (e) { fail("get_move", e); }

  try {
    const r = await client.callTool({ name: "get_type_relations", arguments: { typeName: "electric" } });
    ok("get_type_relations(electric)", r.content[0].text);
  } catch (e) { fail("get_type_relations", e); }

  try {
    const r = await client.callTool({ name: "get_evolution_chain", arguments: { pokemonName: "charmander" } });
    ok("get_evolution_chain(charmander)", r.content[0].text);
  } catch (e) { fail("get_evolution_chain", e); }

  try {
    const r = await client.callTool({ name: "list_pokemon", arguments: { limit: 5, offset: 0 } });
    ok("list_pokemon(5)", r.content[0].text);
  } catch (e) { fail("list_pokemon", e); }

  // ── Tools calculadas (orquestan varias llamadas a PokeAPI) ───────────────
  try {
    const r = await client.callTool({ name: "calculate_damage", arguments: {
      attacker: "charizard", defender: "venusaur", move: "flamethrower", level: 50
    }});
    ok("calculate_damage(charizard→venusaur, flamethrower)", r.content[0].text);
  } catch (e) { fail("calculate_damage", e); }

  try {
    const r = await client.callTool({ name: "suggest_counters", arguments: {
      target: "dragonite", candidates: ["weavile", "togekiss", "garchomp", "magnezone"], limit: 3
    }});
    ok("suggest_counters(dragonite)", r.content[0].text);
  } catch (e) { fail("suggest_counters", e); }

  try {
    const r = await client.callTool({ name: "type_coverage", arguments: {
      team: ["charizard", "blastoise", "venusaur", "pikachu"]
    }});
    ok("type_coverage(team de 4)", r.content[0].text);
  } catch (e) { fail("type_coverage", e); }

  // ── 3. Resources ──────────────────────────────────────────────────────────
  section("3 · Resources");

  try {
    const r = await client.readResource({ uri: "pokedex://type-chart" });
    ok("resource: type-chart", r.contents[0].text);
  } catch (e) { fail("resource: type-chart", e); }

  try {
    const r = await client.readResource({ uri: "mcp://server-info" });
    ok("resource: server-info", r.contents[0].text);
  } catch (e) { fail("resource: server-info", e); }

  try {
    const r = await client.readResource({ uri: "pokemon://gengar" });
    ok("resource template: pokemon://gengar", r.contents[0].text);
  } catch (e) { fail("resource template: pokemon://gengar", e); }

  try {
    const r = await client.readResource({ uri: "type://ghost" });
    ok("resource template: type://ghost", r.contents[0].text);
  } catch (e) { fail("resource template: type://ghost", e); }

  // ── 4. Prompts ────────────────────────────────────────────────────────────
  section("4 · Prompts");

  try {
    const r = await client.getPrompt({
      name: "battle-analysis",
      arguments: { pokemon1: "charizard", pokemon2: "blastoise", format: "singles" },
    });
    ok("prompt: battle-analysis", r.messages[0].content.text);
  } catch (e) { fail("prompt: battle-analysis", e); }

  try {
    const r = await client.getPrompt({
      name: "pokedex-entry",
      arguments: { pokemonName: "mewtwo", style: "scarlet" },
    });
    ok("prompt: pokedex-entry", r.messages[0].content.text);
  } catch (e) { fail("prompt: pokedex-entry", e); }

  try {
    const r = await client.getPrompt({
      name: "team-builder",
      arguments: { corePokemon: "garchomp", tier: "OU" },
    });
    ok("prompt: team-builder", r.messages[0].content.text);
  } catch (e) { fail("prompt: team-builder", e); }

  // ── Done ──────────────────────────────────────────────────────────────────
  section("Done");
  console.log("All tests completed.\n");

  await client.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
