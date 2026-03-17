const ROOM_QUERY_KEY = 'room';

/**
 * @param {{ baseUrl: string, roomId: string }} params
 */
export function buildInviteUrl(params) {
  const { baseUrl, roomId } = params;

  if (!baseUrl || typeof baseUrl !== 'string') {
    throw new Error('baseUrl is required');
  }

  if (!roomId || typeof roomId !== 'string') {
    throw new Error('roomId is required');
  }

  const url = new URL('/dog', ensureTrailingSlash(baseUrl));
  url.searchParams.set(ROOM_QUERY_KEY, roomId);
  return url.toString();
}

/**
 * @param {string} inviteUrl
 */
export function parseInviteUrl(inviteUrl) {
  if (!inviteUrl || typeof inviteUrl !== 'string') {
    throw new Error('inviteUrl is required');
  }

  const url = new URL(inviteUrl);
  const roomId = url.searchParams.get(ROOM_QUERY_KEY);

  if (!roomId) {
    throw new Error('Invite URL is missing room');
  }

  return {
    roomId,
    path: url.pathname
  };
}

function ensureTrailingSlash(value) {
  return value.endsWith('/') ? value : `${value}/`;
}
