// Standalone Supabase Edge Function entrypoint for dog-room.
//
// This file is intentionally self-contained so it works when copied directly
// into Supabase Dashboard editor (without local repo files present).
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...corsHeaders
    }
  });
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

function createRoom(command: any) {
  const roomId = String(command.roomId ?? '').trim();
  const hostPlayerId = String(command.playerId ?? '').trim();

  if (!roomId) {
    throw new Error('roomId is required');
  }

  if (!hostPlayerId) {
    throw new Error('playerId is required');
  }

  if (states.has(roomId)) {
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

  states.set(roomId, state);

  return {
    ok: true,
    roomId,
    response: { ok: true, roomId },
    public: toPublic(state)
  };
}

function updateRoom(command: any) {
  const roomId = String(command.roomId ?? '').trim();
  if (!roomId) {
    throw new Error('roomId is required');
  }

  const state = states.get(roomId);
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
      states.set(roomId, state);

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
      states.set(roomId, state);

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
      states.set(roomId, state);

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
      return jsonResponse({ ok: true, result: createRoom(payload) }, 200);
    }

    if (payload.type === 'attach') {
      return jsonResponse({ ok: true, result: updateRoom({ ...payload, type: 'attach' }) }, 200);
    }

    return jsonResponse({ ok: true, result: updateRoom(payload) }, 200);
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
