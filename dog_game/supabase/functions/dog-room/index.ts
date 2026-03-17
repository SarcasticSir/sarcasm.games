// Standalone Supabase Edge Function entrypoint for dog-room.
//
// NOTE:
// - Uses Postgres persistence when SUPABASE_SERVICE_ROLE_KEY is available.
// - Falls back to in-memory Map only as a local/dev fallback.
//
// Deploy:
//   supabase functions deploy dog-room --no-verify-jwt

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-max-age': '86400'
};

type RoomConfig = {
  gameMode: 'solo' | 'teams';
  teamCount: number;
  playersPerTeam: number;
};

type Player = {
  playerId: string;
  teamNo: number;
  slotInTeam: number;
  seatNo: number;
  ready: boolean;
  connected: boolean;
};

type RoomState = {
  roomId: string;
  hostPlayerId: string;
  config: RoomConfig;
  maxPlayers: number;
  status: 'lobby' | 'active' | 'finished';
  version: number;
  players: Player[];
  match: null | { phase: 'exchange' | 'play' | 'finished' };
};

const states = new Map<string, RoomState>();
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ROOM_TABLE = 'dog_room_states';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...corsHeaders
    }
  });
}

function canonicalRoomId(raw: unknown) {
  return String(raw ?? '').trim().toUpperCase();
}

function seatFromTeamSlot(teamNo: number, slotInTeam: number, teamCount: number) {
  return (slotInTeam - 1) * teamCount + teamNo;
}

function sortPlayersBySeat(players: Player[]) {
  return [...players].sort((a, b) => a.seatNo - b.seatNo);
}

function toPublic(state: RoomState) {
  return {
    roomId: state.roomId,
    hostPlayerId: state.hostPlayerId,
    status: state.status,
    version: state.version,
    maxPlayers: state.maxPlayers,
    config: state.config,
    players: sortPlayersBySeat(state.players).map((p) => ({
      playerId: p.playerId,
      teamNo: p.teamNo,
      slotInTeam: p.slotInTeam,
      seatNo: p.seatNo,
      ready: p.ready,
      connected: p.connected
    })),
    match: state.match
  };
}

async function hasPersistentStore() {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);
}

async function loadState(roomId: string): Promise<RoomState | null> {
  if (!(await hasPersistentStore())) {
    return states.get(roomId) ?? null;
  }

  const url = `${SUPABASE_URL}/rest/v1/${ROOM_TABLE}?room_id=eq.${encodeURIComponent(roomId)}&select=state&limit=1`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load room state (${response.status})`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return rows[0]?.state ?? null;
}

async function saveState(state: RoomState) {
  if (!(await hasPersistentStore())) {
    states.set(state.roomId, state);
    return;
  }

  const url = `${SUPABASE_URL}/rest/v1/${ROOM_TABLE}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify([
      {
        room_id: state.roomId,
        state,
        updated_at: new Date().toISOString()
      }
    ])
  });

  if (!response.ok) {
    throw new Error(`Failed to persist room state (${response.status})`);
  }
}

async function createRoom(command: any) {
  const roomId = canonicalRoomId(command.roomId);
  const hostPlayerId = String(command.playerId ?? '').trim();

  if (!roomId) {
    throw new Error('roomId is required');
  }

  if (!hostPlayerId) {
    throw new Error('playerId is required');
  }

  const existing = await loadState(roomId);
  if (existing) {
    throw new Error(`Room already exists: ${roomId}`);
  }

  const config: RoomConfig = {
    gameMode: command.gameMode === 'teams' ? 'teams' : 'solo',
    teamCount: Number(command.teamCount ?? 4),
    playersPerTeam: Number(command.playersPerTeam ?? 1)
  };

  const maxPlayers = config.teamCount * config.playersPerTeam;
  if (maxPlayers < 4 || maxPlayers > 8) {
    throw new Error('Room size must be between 4 and 8 players');
  }

  const host: Player = {
    playerId: hostPlayerId,
    teamNo: 1,
    slotInTeam: 1,
    seatNo: seatFromTeamSlot(1, 1, config.teamCount),
    ready: false,
    connected: true
  };

  const state: RoomState = {
    roomId,
    hostPlayerId,
    config,
    maxPlayers,
    status: 'lobby',
    version: 1,
    players: [host],
    match: null
  };

  await saveState(state);

  return {
    ok: true,
    roomId,
    response: { ok: true, roomId },
    public: toPublic(state)
  };
}

async function updateRoom(command: any) {
  const roomId = canonicalRoomId(command.roomId);
  if (!roomId) {
    throw new Error('roomId is required');
  }

  const state = await loadState(roomId);
  if (!state) {
    throw new Error(`Unknown room: ${roomId}`);
  }

  switch (command.type) {
    case 'attach': {
      return {
        ok: true,
        roomId,
        public: toPublic(state),
        private: { playerId: command.playerId ?? null }
      };
    }

    case 'get_room': {
      return {
        ok: true,
        roomId,
        public: toPublic(state)
      };
    }

    case 'join_room': {
      if (state.status !== 'lobby') {
        throw new Error('Cannot join after match start');
      }

      const playerId = String(command.playerId ?? '').trim();
      const teamNo = Number(command.teamNo);
      const slotInTeam = Number(command.slotInTeam);

      if (!playerId) {
        throw new Error('playerId is required');
      }

      if (state.players.some((p) => p.playerId === playerId)) {
        return {
          ok: true,
          roomId,
          response: { ok: true, joined: false, reason: 'already_joined', version: state.version },
          public: toPublic(state)
        };
      }

      if (state.players.length >= state.maxPlayers) {
        throw new Error('Room is full');
      }

      if (teamNo < 1 || teamNo > state.config.teamCount) {
        throw new Error('teamNo out of bounds');
      }

      if (slotInTeam < 1 || slotInTeam > state.config.playersPerTeam) {
        throw new Error('slotInTeam out of bounds');
      }

      if (state.players.some((p) => p.teamNo === teamNo && p.slotInTeam === slotInTeam)) {
        throw new Error('Team slot already occupied');
      }

      const seatNo = seatFromTeamSlot(teamNo, slotInTeam, state.config.teamCount);
      state.players.push({
        playerId,
        teamNo,
        slotInTeam,
        seatNo,
        ready: false,
        connected: true
      });
      state.version += 1;
      await saveState(state);

      return {
        ok: true,
        roomId,
        response: { ok: true, joined: true, seatNo, version: state.version },
        public: toPublic(state)
      };
    }

    case 'set_ready': {
      if (state.status !== 'lobby') {
        throw new Error('Cannot set ready after match start');
      }

      const playerId = String(command.playerId ?? '').trim();
      const player = state.players.find((p) => p.playerId === playerId);
      if (!player) {
        throw new Error('Player not in room');
      }

      player.ready = Boolean(command.isReady);
      state.version += 1;
      await saveState(state);

      return {
        ok: true,
        roomId,
        response: { ok: true, version: state.version },
        public: toPublic(state)
      };
    }

    case 'start_match': {
      const playerId = String(command.playerId ?? '').trim();
      if (state.hostPlayerId !== playerId) {
        throw new Error('Only host can start match');
      }

      if (state.status !== 'lobby') {
        throw new Error('Match already started');
      }

      if (state.players.length !== state.maxPlayers) {
        throw new Error('Room is not full');
      }

      state.status = 'active';
      state.match = {
        phase: state.config.gameMode === 'teams' ? 'exchange' : 'play'
      };
      state.version += 1;
      await saveState(state);

      return {
        ok: true,
        roomId,
        response: { ok: true, started: true, phase: state.match.phase, version: state.version },
        public: toPublic(state)
      };
    }

    default:
      throw new Error(`Unsupported command in standalone mode: ${command.type}`);
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  try {
    const payload = await request.json();
    if (!payload || typeof payload !== 'object' || typeof payload.type !== 'string') {
      return jsonResponse({ ok: false, error: 'Missing command type' }, 400);
    }

    if (payload.type === 'create_room') {
      return jsonResponse({ ok: true, result: await createRoom(payload) }, 200);
    }

    if (payload.type === 'attach') {
      return jsonResponse({ ok: true, result: await updateRoom({ ...payload, type: 'attach' }) }, 200);
    }

    return jsonResponse({ ok: true, result: await updateRoom(payload) }, 200);
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      500
    );
  }
});
