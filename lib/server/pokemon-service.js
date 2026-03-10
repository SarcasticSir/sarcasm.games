function normalizePokemonTypes(typesValue) {
  if (!typesValue) return [];

  if (Array.isArray(typesValue)) {
    return typesValue.map((value) => String(value).toLowerCase());
  }

  if (typeof typesValue === 'string') {
    try {
      const parsed = JSON.parse(typesValue);
      if (Array.isArray(parsed)) {
        return parsed.map((value) => String(value).toLowerCase());
      }
    } catch (_error) {
      return typesValue
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
    }
  }

  return [];
}

function resolveWeatherMultiplier(pokemonTypes, weatherMultiplierMap) {
  let multiplier = 1;
  let bestBoostedType = null;

  for (const type of pokemonTypes) {
    const candidate = Number(weatherMultiplierMap[type] || 1);
    if (candidate > multiplier) {
      multiplier = candidate;
      bestBoostedType = type;
    }
  }

  return {
    multiplier,
    boostedType: bestBoostedType
  };
}

function computePokemonIncomePerSecond(baseIncome, types, weatherMultiplierMap) {
  const normalizedTypes = normalizePokemonTypes(types);
  const { multiplier, boostedType } = resolveWeatherMultiplier(normalizedTypes, weatherMultiplierMap);
  const normalizedBaseIncome = Number(baseIncome || 0);

  return {
    baseIncomePerSecond: normalizedBaseIncome,
    incomePerSecond: normalizedBaseIncome * multiplier,
    weatherMultiplier: multiplier,
    boostedType,
    types: normalizedTypes
  };
}

module.exports = {
  normalizePokemonTypes,
  resolveWeatherMultiplier,
  computePokemonIncomePerSecond
};
