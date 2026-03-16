import test from 'node:test';
import assert from 'node:assert/strict';

import { handleEdgeRoomRequest } from '../services/realtime-server/supabase-edge-handler.js';
import { createSupabaseRoomService } from '../services/realtime-server/supabase-room-service.js';
import { parseInviteUrl } from '../services/realtime-server/invite-url.js';

function createInMemoryStore() {
  const states = new Map();
  const events = [];

  return {
    states,
    events,
    async loadRoomState(roomId) {
      return states.get(roomId) ?? null;
    },
    async saveRoomState(roomId, state) {
      states.set(roomId, structuredClone(state));
    },
    async appendGameEvent(event) {
      events.push(event);
    }
  };
}

function createPublisherSpy() {
  return {
    roomSnapshots: [],
    playerSnapshots: [],
    async publishRoomSnapshot(roomId, snapshot) {
      this.roomSnapshots.push({ roomId, snapshot });
    },
    async publishPlayerSnapshot(roomId, playerId, snapshot) {
      this.playerSnapshots.push({ roomId, playerId, snapshot });
    }
  };
}

test('supabase room service can create room and process join/ready/start commands', async () => {
  const store = createInMemoryStore();
  const publisher = createPublisherSpy();
  const service = createSupabaseRoomService({ store, publisher });

  const created = await service.processRoomCommand({
    type: 'create_room',
    roomId: 'DOG123',
    playerId: 'P1',
    gameMode: 'solo',
    teamCount: 4,
    playersPerTeam: 1
  });

  assert.equal(created.response.ok, true);
  assert.equal(created.public.status, 'lobby');

  await service.processRoomCommand({
    type: 'join_room',
    roomId: 'DOG123',
    playerId: 'P2',
    teamNo: 2,
    slotInTeam: 1
  });

  await service.processRoomCommand({
    type: 'join_room',
    roomId: 'DOG123',
    playerId: 'P3',
    teamNo: 3,
    slotInTeam: 1
  });

  await service.processRoomCommand({
    type: 'join_room',
    roomId: 'DOG123',
    playerId: 'P4',
    teamNo: 4,
    slotInTeam: 1
  });

  for (const playerId of ['P1', 'P2', 'P3', 'P4']) {
    await service.processRoomCommand({
      type: 'set_ready',
      roomId: 'DOG123',
      playerId,
      isReady: true
    });
  }

  const started = await service.processRoomCommand({
    type: 'start_match',
    roomId: 'DOG123',
    playerId: 'P1'
  });

  assert.equal(started.public.status, 'active');
  assert.equal(started.public.match.phase, 'play');
  assert.equal(store.events.length > 0, true);
  assert.equal(publisher.roomSnapshots.length > 0, true);
  assert.equal(publisher.playerSnapshots.some((item) => item.playerId === 'P1'), true);
});



test('create_room returns invite URL that can be parsed and used for join flow', async () => {
  const store = createInMemoryStore();
  const service = createSupabaseRoomService({
    store,
    publisher: createPublisherSpy()
  });

  const created = await service.processRoomCommand({
    type: 'create_room',
    roomId: 'DOG-INV-1',
    playerId: 'P1',
    gameMode: 'solo',
    teamCount: 4,
    playersPerTeam: 1,
    clientBaseUrl: 'https://sarcasm.games'
  });

  const inviteUrl = created.response.inviteUrl;
  assert.ok(inviteUrl);

  const parsed = parseInviteUrl(inviteUrl);
  assert.equal(parsed.roomId, 'DOG-INV-1');

  const joined = await service.processRoomCommand({
    type: 'join_room',
    roomId: parsed.roomId,
    playerId: 'P2',
    teamNo: 2,
    slotInTeam: 1
  });

  assert.equal(joined.response.ok, true);
  assert.equal(joined.response.joined, true);
  assert.equal(joined.public.players.length, 2);
});

test('attach returns public and private snapshot for reconnecting player', async () => {
  const service = createSupabaseRoomService({
    store: createInMemoryStore(),
    publisher: createPublisherSpy()
  });

  await service.processRoomCommand({
    type: 'create_room',
    roomId: 'DOG124',
    playerId: 'P1',
    gameMode: 'solo',
    teamCount: 4,
    playersPerTeam: 1
  });

  const attached = await service.attach('DOG124', 'P1');
  assert.equal(attached.public.roomId, 'DOG124');
  assert.equal(attached.private.playerId, 'P1');
});

test('edge handler routes command payloads and returns json responses', async () => {
  const service = createSupabaseRoomService({
    store: createInMemoryStore(),
    publisher: createPublisherSpy()
  });

  const createReq = new Request('http://localhost/room-command', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'create_room',
      roomId: 'DOG200',
      playerId: 'P1',
      gameMode: 'solo',
      teamCount: 4,
      playersPerTeam: 1
    })
  });

  const createRes = await handleEdgeRoomRequest({ request: createReq, roomService: service });
  assert.equal(createRes.status, 200);

  const attachReq = new Request('http://localhost/room-command', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'attach', roomId: 'DOG200', playerId: 'P1' })
  });

  const attachRes = await handleEdgeRoomRequest({ request: attachReq, roomService: service });
  const attachBody = await attachRes.json();

  assert.equal(attachRes.status, 200);
  assert.equal(attachBody.ok, true);
  assert.equal(attachBody.result.private.playerId, 'P1');
});


test('edge handler responds to CORS preflight OPTIONS requests', async () => {
  const service = createSupabaseRoomService({
    store: createInMemoryStore(),
    publisher: createPublisherSpy()
  });

  const preflightReq = new Request('http://localhost/room-command', {
    method: 'OPTIONS',
    headers: {
      origin: 'https://www.sarcasm.games',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type, apikey'
    }
  });

  const preflightRes = await handleEdgeRoomRequest({ request: preflightReq, roomService: service });

  assert.equal(preflightRes.status, 204);
  assert.equal(preflightRes.headers.get('access-control-allow-origin'), 'https://www.sarcasm.games');
  assert.equal(preflightRes.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
});

test('edge handler includes CORS headers on POST responses', async () => {
  const service = createSupabaseRoomService({
    store: createInMemoryStore(),
    publisher: createPublisherSpy()
  });

  const createReq = new Request('http://localhost/room-command', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://www.sarcasm.games'
    },
    body: JSON.stringify({
      type: 'create_room',
      roomId: 'DOG-CORS-1',
      playerId: 'P1',
      gameMode: 'solo',
      teamCount: 4,
      playersPerTeam: 1
    })
  });

  const createRes = await handleEdgeRoomRequest({ request: createReq, roomService: service });

  assert.equal(createRes.status, 200);
  assert.equal(createRes.headers.get('access-control-allow-origin'), 'https://www.sarcasm.games');
  assert.equal(createRes.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
});
