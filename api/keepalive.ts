import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const cronSecret = process.env.CRON_SECRET || '';

function getBearerToken(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader !== 'string') return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token.trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!cronSecret) {
    console.error('[keepalive] Missing CRON_SECRET');
    return res.status(500).json({ error: 'Server not configured' });
  }

  const providedSecret = getBearerToken(req);
  if (!providedSecret || providedSecret !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('[keepalive] Missing Supabase server credentials');
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const startedAt = Date.now();
    const { error, count } = await supabase
      .from('gallery')
      .select('*', { head: true, count: 'exact' })
      .limit(1);

    if (error) {
      console.error('[keepalive] Supabase ping failed', error);
      return res.status(500).json({ error: 'Keepalive ping failed' });
    }

    res.setHeader('cache-control', 'no-store');
    return res.status(200).json({
      ok: true,
      table: 'gallery',
      count: count ?? 0,
      durationMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[keepalive] Unexpected error', error);
    return res.status(500).json({ error: 'Keepalive error' });
  }
}
