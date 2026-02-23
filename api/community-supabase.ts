import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  try {
    const rawDeckType = req.query.deckType;
    const deckType = Array.isArray(rawDeckType) ? rawDeckType[0] : rawDeckType;

    let query = supabase
      .from('gallery')
      .select('*')
      .order('timestamp', { ascending: false });

    if (deckType && deckType.trim()) {
      query = query.eq('deck_type', deckType.trim());
    }

    const { data, error } = await query;

    if (error) throw error;
    return res.status(200).json({ galleries: data || [] });
  } catch (err: any) {
    console.error('[community-supabase] error:', err);
    return res.status(500).json({ error: err?.message || 'Fetch failed' });
  }
}
