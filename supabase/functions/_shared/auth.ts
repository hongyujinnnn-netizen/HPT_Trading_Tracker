/**
 * Shared caller authorization for server-only Edge Functions.
 *
 * These functions run with the service_role key and write to the database, so
 * they must NOT be callable by browsers holding the public anon key.
 *
 * A request is accepted when EITHER:
 *   1. header `x-cron-secret` matches the CRON_SECRET function secret, OR
 *   2. `Authorization: Bearer <token>` matches SUPABASE_SERVICE_ROLE_KEY
 *      (this is what supabase/cron_setup.sql sends from pg_cron).
 */

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  // Compare full length regardless of mismatch position to avoid timing leaks
  let diff = aBytes.length ^ bBytes.length;
  const len = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < len; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

export function isAuthorizedCaller(req: Request): boolean {
  const cronSecret = Deno.env.get('CRON_SECRET') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  const headerSecret = req.headers.get('x-cron-secret') || '';
  if (cronSecret && headerSecret && timingSafeEqual(headerSecret, cronSecret)) {
    return true;
  }

  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (serviceKey && bearer && timingSafeEqual(bearer, serviceKey)) {
    return true;
  }

  return false;
}

export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function methodNotAllowedResponse(): Response {
  return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', Allow: 'POST' },
  });
}
