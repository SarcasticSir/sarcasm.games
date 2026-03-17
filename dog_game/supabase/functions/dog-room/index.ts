// Supabase Edge Function entrypoint for dog-room.
//
// This entrypoint is wired to the shared authoritative room engine so gameplay
// commands (including deck creation, card dealing, previews and confirms) are
// handled consistently with local tests.

import { createSupabaseRoomService } from '../../../services/realtime-server/supabase-room-service.js';
import { handleEdgeRoomRequest } from '../../../services/realtime-server/supabase-edge-handler.js';

type PersistedStateRow = {
  state: unknown;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ALLOW_IN_MEMORY_FALLBACK = Deno.env.get('DOG_ALLOW_IN_MEMORY_FALLBACK') === '1';
const ROOM_TABLE = 'dog_room_states';
const STORAGE_TIMEOUT_MS = 5000;

const inMemoryStates = new Map<string, unknown>();

function hasPersistentStore() {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);
}

function persistenceConfigError() {
  return new Error(
    'Persistence is not configured: set SUPABASE_SERVICE_ROLE_KEY for the dog-room function, or set DOG_ALLOW_IN_MEMORY_FALLBACK=1 for local dev only.'
  );
}

function canonicalRoomId(raw: unknown) {
  return String(raw ?? '').trim().toUpperCase();
}

async function loadRoomState(roomId: string) {
  if (!hasPersistentStore()) {
    if (!ALLOW_IN_MEMORY_FALLBACK) {
      throw persistenceConfigError();
    }

    return inMemoryStates.get(roomId) ?? null;
  }

  const url = `${SUPABASE_URL}/rest/v1/${ROOM_TABLE}?room_id=eq.${encodeURIComponent(roomId)}&select=state&limit=1`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      accept: 'application/json'
    },
    signal: AbortSignal.timeout(STORAGE_TIMEOUT_MS)
  });

  if (!response.ok) {
    const details = (await response.text()).slice(0, 220);
    throw new Error(`Failed to load room state (${response.status}): ${details || 'no details'}`);
  }

  const rows = (await response.json()) as PersistedStateRow[];
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return rows[0]?.state ?? null;
}

async function saveRoomState(roomId: string, state: unknown) {
  if (!hasPersistentStore()) {
    if (!ALLOW_IN_MEMORY_FALLBACK) {
      throw persistenceConfigError();
    }

    inMemoryStates.set(roomId, state);
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
        room_id: roomId,
        state,
        updated_at: new Date().toISOString()
      }
    ]),
    signal: AbortSignal.timeout(STORAGE_TIMEOUT_MS)
  });

  if (!response.ok) {
    const details = (await response.text()).slice(0, 220);
    throw new Error(`Failed to persist room state (${response.status}): ${details || 'no details'}`);
  }
}

const roomService = createSupabaseRoomService({
  store: {
    loadRoomState: async (roomId: string) => loadRoomState(canonicalRoomId(roomId)),
    saveRoomState: async (roomId: string, state: unknown) => saveRoomState(canonicalRoomId(roomId), state)
  }
});

Deno.serve(async (request) => {
  if (request.method === 'POST') {
    const cloned = request.clone();
    const payload = await cloned.json().catch(() => null);

    if (payload && typeof payload === 'object' && 'roomId' in payload) {
      (payload as { roomId?: unknown }).roomId = canonicalRoomId((payload as { roomId?: unknown }).roomId);
      request = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: JSON.stringify(payload)
      });
    }
  }

  return handleEdgeRoomRequest({ request, roomService });
});
