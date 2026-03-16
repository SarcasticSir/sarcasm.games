/**
 * @param {Request} request
 */
function buildCorsHeaders(request) {
  const origin = request.headers.get('origin') ?? '*';

  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-max-age': '86400',
    vary: 'origin'
  };
}

/**
 * @param {unknown} payload
 */
function validateCommandPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Request body must be a JSON object');
  }

  if (!('type' in payload) || typeof payload.type !== 'string') {
    throw new Error('Missing command type');
  }

  return payload;
}

/**
 * @param {Request} request
 * @param {any} body
 * @param {number} status
 */
function jsonResponse(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...buildCorsHeaders(request)
    }
  });
}

/**
 * @param {Request} request
 */
function preflightResponse(request) {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(request)
  });
}

/**
 * @param {{
 *  request: Request,
 *  roomService: { processRoomCommand: (command:any)=>Promise<any>, attach: (roomId:string, playerId?:string)=>Promise<any> }
 * }} params
 */
export async function handleEdgeRoomRequest(params) {
  const { request, roomService } = params;

  if (request.method === 'OPTIONS') {
    return preflightResponse(request);
  }

  try {
    const payload = validateCommandPayload(await request.json());

    if (payload.type === 'attach') {
      const result = await roomService.attach(payload.roomId, payload.playerId);
      return jsonResponse(request, { ok: true, result }, 200);
    }

    const result = await roomService.processRoomCommand(payload);
    return jsonResponse(request, { ok: true, result }, 200);
  } catch (error) {
    return jsonResponse(
      request,
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      400
    );
  }
}
