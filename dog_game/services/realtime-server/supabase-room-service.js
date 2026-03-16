import {
  createRoom,
  getPlayerPrivateView,
  getPublicRoomView,
  handleRoomCommand
} from './room-engine.js';

function toEvent(type, roomId, payload) {
  return {
    type,
    roomId,
    payload,
    createdAt: new Date().toISOString()
  };
}

/**
 * @typedef {{
 *  loadRoomState: (roomId: string) => Promise<any|null>,
 *  saveRoomState: (roomId: string, state: any) => Promise<void>,
 *  appendGameEvent?: (event: {type:string,roomId:string,payload:any,createdAt:string}) => Promise<void>
 * }} RoomStateStore
 */

/**
 * @typedef {{
 *  publishRoomSnapshot?: (roomId: string, snapshot: any) => Promise<void>,
 *  publishPlayerSnapshot?: (roomId: string, playerId: string, snapshot: any) => Promise<void>
 * }} RealtimePublisher
 */

/**
 * @param {{ store: RoomStateStore, publisher?: RealtimePublisher }} deps
 */
export function createSupabaseRoomService(deps) {
  const { store, publisher = {} } = deps;

  if (!store?.loadRoomState || !store?.saveRoomState) {
    throw new Error('store must provide loadRoomState and saveRoomState');
  }

  async function persistAndPublish(roomId, state, actorPlayerId, eventType, response) {
    await store.saveRoomState(roomId, state);

    if (store.appendGameEvent) {
      await store.appendGameEvent(
        toEvent(eventType, roomId, {
          actorPlayerId,
          response,
          version: state.version
        })
      );
    }

    if (publisher.publishRoomSnapshot) {
      await publisher.publishRoomSnapshot(roomId, getPublicRoomView(state));
    }

    if (actorPlayerId && publisher.publishPlayerSnapshot) {
      await publisher.publishPlayerSnapshot(roomId, actorPlayerId, getPlayerPrivateView(state, actorPlayerId));
    }
  }

  async function createRoomCommand(command) {
    const existing = await store.loadRoomState(command.roomId);
    if (existing) {
      throw new Error(`Room already exists: ${command.roomId}`);
    }

    const state = createRoom(command);
    await persistAndPublish(command.roomId, state, command.playerId ?? command.hostPlayerId, 'room_created', {
      ok: true,
      roomId: command.roomId
    });

    return {
      roomId: command.roomId,
      response: { ok: true, roomId: command.roomId },
      public: getPublicRoomView(state),
      private: command.playerId ? getPlayerPrivateView(state, command.playerId).private : null
    };
  }

  async function processRoomCommand(command) {
    if (command.type === 'create_room') {
      return createRoomCommand({
        roomId: command.roomId,
        hostPlayerId: command.playerId,
        playerId: command.playerId,
        gameMode: command.gameMode,
        teamCount: command.teamCount,
        playersPerTeam: command.playersPerTeam,
        idempotencyKey: command.idempotencyKey
      });
    }

    const state = await store.loadRoomState(command.roomId);
    if (!state) {
      throw new Error(`Unknown room: ${command.roomId}`);
    }

    const result = handleRoomCommand(state, {
      ...command,
      expectedVersion: state.version
    });

    const actorPlayerId = command.playerId ?? null;
    await persistAndPublish(command.roomId, result.state, actorPlayerId, command.type, result.response);

    return {
      roomId: command.roomId,
      response: result.response,
      public: getPublicRoomView(result.state),
      private: actorPlayerId ? getPlayerPrivateView(result.state, actorPlayerId).private : null
    };
  }

  async function attach(roomId, playerId) {
    const state = await store.loadRoomState(roomId);
    if (!state) {
      throw new Error(`Unknown room: ${roomId}`);
    }

    return {
      roomId,
      public: getPublicRoomView(state),
      private: playerId ? getPlayerPrivateView(state, playerId).private : null
    };
  }

  return {
    processRoomCommand,
    attach
  };
}
