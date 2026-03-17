// Supabase Edge Function entrypoint for dog-room.
//
// Why this shape:
// - Handles OPTIONS preflight before loading game modules.
// - Returns CORS headers on all responses.
// - Lazy-loads room engine modules so import errors become JSON errors
//   (instead of opaque preflight/network failures).
//
// Deploy:
//   supabase functions deploy dog-room --no-verify-jwt

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-max-age': '86400'
};

type RoomService = {
  processRoomCommand: (command: any) => Promise<any>;
  attach: (roomId: string, playerId?: string) => Promise<any>;
};

let cachedRoomService: RoomService | null = null;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...corsHeaders
    }
  });
}

function buildInMemoryStore() {
  const states = new Map<string, any>();

  return {
    async loadRoomState(roomId: string) {
      return states.get(roomId) ?? null;
    },
    async saveRoomState(roomId: string, state: any) {
      states.set(roomId, structuredClone(state));
    }
  };
}

async function getRoomService(): Promise<RoomService> {
  if (cachedRoomService) {
    return cachedRoomService;
  }

  const [{ createSupabaseRoomService }] = await Promise.all([
    import('../../../../services/realtime-server/supabase-room-service.js')
  ]);

  cachedRoomService = createSupabaseRoomService({
    store: buildInMemoryStore()
  });

  return cachedRoomService;
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
    const roomService = await getRoomService();
    const { handleEdgeRoomRequest } = await import('../../../../services/realtime-server/supabase-edge-handler.js');

    return await handleEdgeRoomRequest({ request, roomService });
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
