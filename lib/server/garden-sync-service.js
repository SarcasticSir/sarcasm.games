const { runQuery } = require('../../api/_lib/db');
const { fetchCurrentWeather } = require('./weather-service');
const { computePokemonIncomePerSecond } = require('./pokemon-service');
const { getFinishedLures } = require('./lure-service');

const ESSENCE_TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'
];

function getEssenceColumn(type) {
  return `${type}_essence`;
}

function createEmptyEssenceState() {
  return ESSENCE_TYPES.reduce((acc, type) => {
    acc[getEssenceColumn(type)] = 0;
    return acc;
  }, {});
}

async function ensureGardenRow(userId) {
  const result = await runQuery(
    `INSERT INTO user_gardens (user_id, last_sync_at)
     VALUES ($1, NOW())
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING *`,
    [userId]
  );
  return result.rows[0] || null;
}

async function getActivePokemon(userId) {
  const result = await runQuery(
    `SELECT id, pokemon_id, name, sprite_url, types, level, base_income, is_active, slot_index
     FROM user_pokemon
     WHERE user_id = $1
       AND is_active = TRUE
       AND slot_index BETWEEN 1 AND 6
     ORDER BY slot_index ASC`,
    [userId]
  );
  return result.rows;
}

function computeProduction(activePokemon, weather) {
  const totals = {
    totalPerSecond: 0,
    byTypePerSecond: createEmptyEssenceState(),
    pokemon: []
  };

  for (const pokemon of activePokemon) {
    const income = computePokemonIncomePerSecond(pokemon.base_income, pokemon.types, weather.multiplierMap);
    totals.totalPerSecond += income.incomePerSecond;

    for (const type of income.types) {
      const column = getEssenceColumn(type);
      if (!(column in totals.byTypePerSecond)) continue;
      totals.byTypePerSecond[column] += income.incomePerSecond;
    }

    totals.pokemon.push({
      id: pokemon.id,
      pokemonId: pokemon.pokemon_id,
      name: pokemon.name,
      spriteUrl: pokemon.sprite_url,
      level: pokemon.level,
      slotIndex: pokemon.slot_index,
      types: income.types,
      baseIncomePerSecond: income.baseIncomePerSecond,
      incomePerSecond: income.incomePerSecond,
      weatherMultiplier: income.weatherMultiplier,
      boostedType: income.boostedType
    });
  }

  return totals;
}

async function updateGardenResources(userId, secondsSinceLastSync, byTypePerSecond) {
  const values = ESSENCE_TYPES.map((type) => {
    const column = getEssenceColumn(type);
    return byTypePerSecond[column] * secondsSinceLastSync;
  });

  const assignments = ESSENCE_TYPES.map((type, index) => {
    const column = getEssenceColumn(type);
    return `${column} = COALESCE(${column}, 0) + $${index + 2}`;
  }).join(', ');

  await runQuery(
    `UPDATE user_gardens
     SET ${assignments},
         last_sync_at = NOW(),
         updated_at = NOW()
     WHERE user_id = $1`,
    [userId, ...values]
  );
}

async function getGardenEssence(userId) {
  const selectColumns = ESSENCE_TYPES.map((type) => getEssenceColumn(type)).join(', ');
  const result = await runQuery(
    `SELECT ${selectColumns}, last_sync_at
     FROM user_gardens
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}

async function syncGarden(userId) {
  const [weather, garden, activePokemon] = await Promise.all([
    fetchCurrentWeather(),
    ensureGardenRow(userId),
    getActivePokemon(userId)
  ]);

  const now = Date.now();
  const lastSync = garden?.last_sync_at ? new Date(garden.last_sync_at).getTime() : now;
  const secondsSinceLastSync = Math.max(0, Math.floor((now - lastSync) / 1000));
  const production = computeProduction(activePokemon, weather);

  if (secondsSinceLastSync > 0) {
    await updateGardenResources(userId, secondsSinceLastSync, production.byTypePerSecond);
  }

  const [resourceState, finishedLures] = await Promise.all([
    getGardenEssence(userId),
    getFinishedLures(userId)
  ]);

  return {
    weather,
    secondsSinceLastSync,
    productionPerSecond: production.totalPerSecond,
    activePokemon: production.pokemon,
    resources: resourceState,
    weatherBonuses: weather.boostedTypes,
    finishedLures,
    claimableRewards: []
  };
}

module.exports = {
  syncGarden,
  ESSENCE_TYPES
};
