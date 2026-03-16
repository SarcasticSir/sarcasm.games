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
 * @param {{
 *  request: Request,
 *  roomService: { processRoomCommand: (command:any)=>Promise<any>, attach: (roomId:string, playerId?:string)=>Promise<any> }
 * }} params
 */
export async function handleEdgeRoomRequest(params) {
  const { request, roomService } = params;

  try {
    const payload = validateCommandPayload(await request.json());

    if (payload.type === 'attach') {
      const result = await roomService.attach(payload.roomId, payload.playerId);
      return new Response(JSON.stringify({ ok: true, result }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }

    const result = await roomService.processRoomCommand(payload);
    return new Response(JSON.stringify({ ok: true, result }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 400,
        headers: { 'content-type': 'application/json' }
      }
    );
  }
}
