import http from 'node:http';
import { WebSocketServer } from 'ws';

import {
  createRoom,
  getPlayerPrivateView,
  getPublicRoomView,
  handleRoomCommand
} from './room-engine.js';

const PORT = Number(process.env.PORT ?? 8787);

const rooms = new Map();
const socketsByRoom = new Map();
const socketMeta = new WeakMap();

function broadcastRoom(roomId) {
  const state = rooms.get(roomId);
  const sockets = socketsByRoom.get(roomId) ?? new Set();

  for (const socket of sockets) {
    if (socket.readyState !== socket.OPEN) {
      continue;
    }

    const meta = socketMeta.get(socket);
    const payload = {
      type: 'room_snapshot',
      roomId,
      public: getPublicRoomView(state),
      private: meta?.playerId ? getPlayerPrivateView(state, meta.playerId).private : null
    };

    socket.send(JSON.stringify(payload));
  }
}

function ensureRoom(roomId) {
  const state = rooms.get(roomId);
  if (!state) {
    throw new Error(`Unknown room: ${roomId}`);
  }

  return state;
}

function applyCommand(roomId, command) {
  const state = ensureRoom(roomId);
  const result = handleRoomCommand(state, {
    ...command,
    expectedVersion: state.version
  });

  rooms.set(roomId, result.state);
  broadcastRoom(roomId);
  return result.response;
}

function send(socket, payload) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function handleClientMessage(socket, raw) {
  let message;

  try {
    message = JSON.parse(raw.toString());
  } catch {
    send(socket, { type: 'error', error: 'Invalid JSON payload' });
    return;
  }

  try {
    switch (message.type) {
      case 'create_room': {
        const roomId = message.roomId;
        if (rooms.has(roomId)) {
          throw new Error(`Room already exists: ${roomId}`);
        }

        const state = createRoom({
          roomId,
          hostPlayerId: message.playerId,
          gameMode: message.gameMode ?? 'solo',
          teamCount: message.teamCount ?? 4,
          playersPerTeam: message.playersPerTeam ?? 1
        });

        rooms.set(roomId, state);
        if (!socketsByRoom.has(roomId)) {
          socketsByRoom.set(roomId, new Set());
        }

        socketMeta.set(socket, { roomId, playerId: message.playerId });
        socketsByRoom.get(roomId).add(socket);

        send(socket, {
          type: 'command_ok',
          command: 'create_room',
          roomId,
          response: { ok: true, roomId }
        });

        broadcastRoom(roomId);
        return;
      }

      case 'attach': {
        const state = ensureRoom(message.roomId);
        socketMeta.set(socket, {
          roomId: message.roomId,
          playerId: message.playerId ?? null
        });

        if (!socketsByRoom.has(message.roomId)) {
          socketsByRoom.set(message.roomId, new Set());
        }

        socketsByRoom.get(message.roomId).add(socket);

        send(socket, {
          type: 'command_ok',
          command: 'attach',
          roomId: message.roomId,
          response: {
            ok: true,
            public: getPublicRoomView(state),
            private: message.playerId ? getPlayerPrivateView(state, message.playerId).private : null
          }
        });

        return;
      }

      case 'join_room': {
        const response = applyCommand(message.roomId, {
          type: 'join_room',
          playerId: message.playerId,
          teamNo: message.teamNo,
          slotInTeam: message.slotInTeam,
          idempotencyKey: message.idempotencyKey
        });

        socketMeta.set(socket, { roomId: message.roomId, playerId: message.playerId });
        if (!socketsByRoom.has(message.roomId)) {
          socketsByRoom.set(message.roomId, new Set());
        }

        socketsByRoom.get(message.roomId).add(socket);

        send(socket, {
          type: 'command_ok',
          command: 'join_room',
          roomId: message.roomId,
          response
        });

        return;
      }

      case 'set_ready':
      case 'start_match':
      case 'exchange_card':
      case 'request_legal_moves':
      case 'start_move_preview':
      case 'cancel_move_preview':
      case 'confirm_move': {
        const response = applyCommand(message.roomId, {
          ...message,
          idempotencyKey: message.idempotencyKey
        });

        send(socket, {
          type: 'command_ok',
          command: message.type,
          roomId: message.roomId,
          response
        });

        return;
      }

      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  } catch (error) {
    send(socket, {
      type: 'command_error',
      command: message.type,
      roomId: message.roomId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(
    JSON.stringify({
      ok: true,
      service: 'dog-game-live-server',
      rooms: rooms.size
    })
  );
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (socket) => {
  send(socket, {
    type: 'welcome',
    protocol: 'dog-game-live-v1',
    note: 'Send create_room/join_room/set_ready/start_match/... messages as JSON'
  });

  socket.on('message', (raw) => handleClientMessage(socket, raw));

  socket.on('close', () => {
    const meta = socketMeta.get(socket);
    if (!meta?.roomId) {
      return;
    }

    const sockets = socketsByRoom.get(meta.roomId);
    if (!sockets) {
      return;
    }

    sockets.delete(socket);
    if (sockets.size === 0) {
      socketsByRoom.delete(meta.roomId);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`dog-game live server listening on http://0.0.0.0:${PORT}`);
  console.log(`websocket endpoint ws://0.0.0.0:${PORT}/ws`);
});
