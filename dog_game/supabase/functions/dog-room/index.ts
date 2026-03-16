// Supabase Edge Function entrypoint template for dog-room.
//
// Important: deploy this function with JWT verification disabled so browser
// preflight (OPTIONS) is not rejected before your handler can answer CORS.
// Example:
//   supabase functions deploy dog-room --no-verify-jwt

import { handleEdgeRoomRequest } from '../../../../services/realtime-server/supabase-edge-handler.js';
import { createSupabaseRoomService } from '../../../../services/realtime-server/supabase-room-service.js';

type RoomState = any;

function createInMemoryStore() {
  const states = new Map<string, RoomState>();

  return {
    async loadRoomState(roomId: string) {
      return states.get(roomId) ?? null;
    },
    async saveRoomState(roomId: string, state: RoomState) {
      states.set(roomId, structuredClone(state));
    }
  };
}

const roomService = createSupabaseRoomService({
  store: createInMemoryStore()
});

Deno.serve((request) => handleEdgeRoomRequest({ request, roomService }));
