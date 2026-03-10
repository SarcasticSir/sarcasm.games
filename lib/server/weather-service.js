const OPEN_WEATHER_ENDPOINT = 'https://api.openweathermap.org/data/2.5/weather';

const WEATHER_TYPE_MAPPING = {
  Rain: {
    weatherKey: 'rain',
    boostedTypes: ['water'],
    multipliers: { water: 1.6 }
  },
  Clear: {
    weatherKey: 'clear',
    boostedTypes: ['grass', 'fire'],
    multipliers: { grass: 1.35, fire: 1.35 }
  },
  Clouds: {
    weatherKey: 'clouds',
    boostedTypes: ['electric', 'flying'],
    multipliers: { electric: 1.3, flying: 1.3 }
  },
  Snow: {
    weatherKey: 'snow',
    boostedTypes: ['ice'],
    multipliers: { ice: 2 }
  },
  Thunderstorm: {
    weatherKey: 'thunderstorm',
    boostedTypes: ['electric'],
    multipliers: { electric: 1.75 }
  },
  Mist: {
    weatherKey: 'mist',
    boostedTypes: ['ghost', 'psychic'],
    multipliers: { ghost: 1.45, psychic: 1.45 }
  },
  Fog: {
    weatherKey: 'mist',
    boostedTypes: ['ghost', 'psychic'],
    multipliers: { ghost: 1.45, psychic: 1.45 }
  }
};

function toGameWeather(rawCondition) {
  const normalizedCondition = typeof rawCondition === 'string' ? rawCondition : 'Unknown';
  const mapping = WEATHER_TYPE_MAPPING[normalizedCondition] || {
    weatherKey: 'neutral',
    boostedTypes: [],
    multipliers: {}
  };

  return {
    rawCondition: normalizedCondition,
    weatherKey: mapping.weatherKey,
    boostedTypes: mapping.boostedTypes,
    multiplierMap: mapping.multipliers
  };
}

function getOpenWeatherLocationParams() {
  const city = process.env.OPENWEATHER_CITY;
  if (city) {
    return { q: city };
  }

  const latitude = process.env.OPENWEATHER_LAT;
  const longitude = process.env.OPENWEATHER_LON;
  if (latitude && longitude) {
    return { lat: latitude, lon: longitude };
  }

  return { q: 'Oslo,NO' };
}

async function fetchCurrentWeather() {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENWEATHER_API_KEY environment variable.');
  }

  const params = new URLSearchParams({
    appid: apiKey,
    units: 'metric',
    ...getOpenWeatherLocationParams()
  });

  const response = await fetch(`${OPEN_WEATHER_ENDPOINT}?${params.toString()}`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenWeather request failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const payload = await response.json();
  const rawCondition = payload?.weather?.[0]?.main || 'Unknown';
  const mappedWeather = toGameWeather(rawCondition);

  return {
    ...mappedWeather,
    source: {
      city: payload?.name || null,
      temperatureC: payload?.main?.temp ?? null
    }
  };
}

module.exports = {
  toGameWeather,
  fetchCurrentWeather
};
