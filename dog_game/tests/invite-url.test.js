import test from 'node:test';
import assert from 'node:assert/strict';

import { buildInviteUrl, parseInviteUrl } from '../services/realtime-server/invite-url.js';

test('buildInviteUrl returns /dog URL with room query param', () => {
  const inviteUrl = buildInviteUrl({
    baseUrl: 'https://sarcasm.games',
    roomId: 'DOG-ROOM-42'
  });

  assert.equal(inviteUrl, 'https://sarcasm.games/dog?room=DOG-ROOM-42');
});

test('parseInviteUrl extracts roomId from invite URL', () => {
  const parsed = parseInviteUrl('https://sarcasm.games/dog?room=DOG-ROOM-42');

  assert.equal(parsed.roomId, 'DOG-ROOM-42');
  assert.equal(parsed.path, '/dog');
});

