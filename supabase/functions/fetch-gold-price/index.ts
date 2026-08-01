import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const goldApiKey = Deno.env.get('GOLDAPI_KEY') || '';

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let price = 4043.70;
  let spread = 0.25;
  let volatility = 'Elevated';
  let source: 'goldapi' | 'simulated' = 'goldapi';
  let isFallback = false;
  let errorDetail: string | null = null;

  async function fetchOpenGoldApi() {
    try {
      const res = await fetch('https://api.gold-api.com/price/XAU');
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.price === 'number') {
          return {
            price: parseFloat(data.price.toFixed(2)),
            spread: parseFloat((data.price * 0.0001).toFixed(2)),
            volatility: 'Elevated',
            source: 'goldapi' as const,
          };
        }
      }
    } catch (_err) {
      // Ignore open API error and try CoinGecko PAXG
    }

    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd&include_24hr_change=true');
      if (res.ok) {
        const data = await res.json();
        if (data && data['pax-gold'] && typeof data['pax-gold'].usd === 'number') {
          return {
            price: parseFloat(data['pax-gold'].usd.toFixed(2)),
            spread: 0.25,
            volatility: Math.abs(data['pax-gold'].usd_24h_change || 0) > 1.0 ? 'High' : 'Elevated',
            source: 'goldapi' as const,
          };
        }
      }
    } catch (_err) {
      // Ignore
    }

    return null;
  }

  if (goldApiKey) {
    let response: Response | null = null;
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        response = await fetch('https://www.goldapi.io/api/XAU/USD', {
          headers: {
            'x-access-token': goldApiKey,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        if (response.ok) break;
      } catch (err: any) {
        console.warn(`[WARN] GoldAPI.io fetch attempt ${attempts} failed: ${err.message}`);
        if (attempts < maxAttempts) {
          await new Promise((res) => setTimeout(res, 1500));
        }
      }
    }

    if (response && response.ok) {
      try {
        const data = await response.json();
        if (data && typeof data.price === 'number') {
          price = parseFloat(data.price.toFixed(2));
          spread = typeof data.ask === 'number' && typeof data.bid === 'number'
            ? parseFloat((data.ask - data.bid).toFixed(2))
            : parseFloat((price * 0.0001).toFixed(2));
          volatility = 'Elevated';
          source = 'goldapi';
        } else {
          throw new Error('Invalid payload from GoldAPI.io');
        }
      } catch (err: any) {
        errorDetail = err.message;
      }
    } else {
      errorDetail = response ? `HTTP ${response.status}` : 'Network error';
    }
  }

  // If GoldAPI.io failed or key not set, try open live gold API endpoints
  if (!goldApiKey || errorDetail) {
    const openData = await fetchOpenGoldApi();
    if (openData) {
      price = openData.price;
      spread = openData.spread;
      volatility = openData.volatility;
      source = 'goldapi';
    } else {
      source = 'simulated';
      isFallback = true;
      const jitter = (Math.random() - 0.48) * 0.40;
      price = parseFloat((4043.20 + jitter).toFixed(2));
      spread = parseFloat((0.24 + Math.random() * 0.08).toFixed(2));
    }
  }

  const capturedAt = new Date().toISOString();

  try {
    const { error: dbError } = await supabase.from('price_snapshots').insert([
      {
        symbol: 'XAUUSD',
        price,
        spread,
        volatility_level: volatility,
        source,
        captured_at: capturedAt,
      },
    ]);

    if (dbError) {
      console.error('[ERROR] Failed to insert row into price_snapshots:', dbError);
    }
  } catch (err: any) {
    console.error('[ERROR] Exception writing price snapshot to database:', err.message);
  }

  const responsePayload = {
    ok: true,
    symbol: 'XAUUSD',
    price,
    spread,
    volatility,
    source,
    is_fallback: isFallback,
    warning: errorDetail,
    captured_at: capturedAt,
  };

  return new Response(JSON.stringify(responsePayload), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
});
