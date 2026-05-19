/**
 * PokeAPI Client
 * Typed wrapper over https://pokeapi.co/api/v2
 * All requests are unauthenticated (public API).
 */

const BASE_URL = "https://pokeapi.co/api/v2";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PokemonStat {
  name: string;
  base_stat: number;
}

export interface PokemonType {
  name: string;
}

export interface PokemonAbility {
  name: string;
  is_hidden: boolean;
}

export interface Pokemon {
  id: number;
  name: string;
  height: number; // decimetres
  weight: number; // hectograms
  base_experience: number;
  types: PokemonType[];
  abilities: PokemonAbility[];
  stats: PokemonStat[];
  sprite: string | null;
}

export interface MoveDetail {
  name: string;
  type: string;
  power: number | null;
  accuracy: number | null;
  pp: number;
  damage_class: string;
  effect: string;
}

export interface EvolutionStage {
  species: string;
  min_level: number | null;
  trigger: string;
}

export interface EvolutionChain {
  stages: EvolutionStage[];
}

export interface TypeRelations {
  name: string;
  double_damage_from: string[];
  double_damage_to: string[];
  half_damage_from: string[];
  half_damage_to: string[];
  no_damage_from: string[];
  no_damage_to: string[];
}

export interface PokemonListEntry {
  name: string;
  id: number;
}

// ─── HTTP Helper ──────────────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`PokeAPI error ${res.status} for ${url}`);
  }
  return res.json() as Promise<T>;
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Fetch a Pokémon by name or national dex number.
 */
export async function getPokemon(nameOrId: string | number): Promise<Pokemon> {
  const raw = await get<any>(`/pokemon/${String(nameOrId).toLowerCase()}`);
  return {
    id: raw.id,
    name: raw.name,
    height: raw.height,
    weight: raw.weight,
    base_experience: raw.base_experience,
    types: raw.types.map((t: any) => ({ name: t.type.name })),
    abilities: raw.abilities.map((a: any) => ({
      name: a.ability.name,
      is_hidden: a.is_hidden,
    })),
    stats: raw.stats.map((s: any) => ({
      name: s.stat.name,
      base_stat: s.base_stat,
    })),
    sprite: raw.sprites?.front_default ?? null,
  };
}

/**
 * Fetch full details of a move.
 */
export async function getMove(nameOrId: string | number): Promise<MoveDetail> {
  const raw = await get<any>(`/move/${String(nameOrId).toLowerCase()}`);
  const effectEntry =
    raw.effect_entries?.find((e: any) => e.language.name === "en")
      ?.short_effect ?? "No description available.";
  return {
    name: raw.name,
    type: raw.type.name,
    power: raw.power,
    accuracy: raw.accuracy,
    pp: raw.pp,
    damage_class: raw.damage_class.name,
    effect: effectEntry,
  };
}

/**
 * Fetch type strengths/weaknesses.
 */
export async function getTypeRelations(typeName: string): Promise<TypeRelations> {
  const raw = await get<any>(`/type/${typeName.toLowerCase()}`);
  const dr = raw.damage_relations;
  return {
    name: raw.name,
    double_damage_from: dr.double_damage_from.map((t: any) => t.name),
    double_damage_to: dr.double_damage_to.map((t: any) => t.name),
    half_damage_from: dr.half_damage_from.map((t: any) => t.name),
    half_damage_to: dr.half_damage_to.map((t: any) => t.name),
    no_damage_from: dr.no_damage_from.map((t: any) => t.name),
    no_damage_to: dr.no_damage_to.map((t: any) => t.name),
  };
}

/**
 * Fetch the evolution chain for a Pokémon species.
 */
export async function getEvolutionChain(pokemonName: string): Promise<EvolutionChain> {
  // 1. Get species to find evolution chain URL
  const species = await get<any>(`/pokemon-species/${pokemonName.toLowerCase()}`);
  const chainUrl: string = species.evolution_chain.url;

  // 2. Walk the chain recursively
  const chainData = await get<any>(chainUrl);
  const stages: EvolutionStage[] = [];

  function walk(node: any, trigger: string | null, minLevel: number | null) {
    stages.push({
      species: node.species.name,
      trigger: trigger ?? "base",
      min_level: minLevel,
    });
    for (const next of node.evolves_to ?? []) {
      const detail = next.evolution_details?.[0];
      walk(
        next,
        detail?.trigger?.name ?? "unknown",
        detail?.min_level ?? null
      );
    }
  }

  walk(chainData.chain, null, null);
  return { stages };
}

/**
 * List Pokémon with pagination.
 */
export async function listPokemon(
  limit = 20,
  offset = 0
): Promise<PokemonListEntry[]> {
  const raw = await get<any>(`/pokemon?limit=${limit}&offset=${offset}`);
  return raw.results.map((p: any, i: number) => ({
    name: p.name,
    // Extract ID from the URL: .../pokemon/1/
    id: parseInt(p.url.split("/").filter(Boolean).pop() ?? "0", 10),
  }));
}
