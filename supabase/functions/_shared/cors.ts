const configuredOrigins = [
  ...(Deno.env.get('ALLOWED_ORIGIN') || '').split(','),
  ...(Deno.env.get('CLIENT_APP_URL') || '').split(','),
]
  .map((origin) => origin.trim())
  .filter(Boolean);

const productionOrigins = new Set([
  'https://hub.tabarakpharmacy.com',
]);

const localDevelopmentOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

const isAllowedOrigin = (origin: string | null) => {
  if (!origin) return true;
  if (configuredOrigins.includes(origin) || productionOrigins.has(origin)) return true;

  // Local fallback is intentionally limited to development when no additional
  // production origin has been configured. The primary production origin above
  // is pinned so a missing secret cannot block the main app.
  return configuredOrigins.length === 0 && localDevelopmentOrigins.has(origin);
};

export const getCorsHeaders = (req?: Request): Record<string, string> => {
  const origin = req?.headers.get('Origin') || null;
  const headers: Record<string, string> = {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else if (!origin && configuredOrigins[0]) {
    headers['Access-Control-Allow-Origin'] = configuredOrigins[0];
  }

  return headers;
};

export const corsHeaders = getCorsHeaders();

export const handleCorsPreflight = (req: Request) => {
  if (!isAllowedOrigin(req.headers.get('Origin'))) {
    return new Response('Forbidden origin', {
      status: 403,
      headers: { 'Vary': 'Origin' },
    });
  }

  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(req),
  });
};

export const rejectDisallowedOrigin = (req: Request) => {
  if (isAllowedOrigin(req.headers.get('Origin'))) return null;

  return new Response(JSON.stringify({ error: 'Forbidden origin' }), {
    status: 403,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  });
};
