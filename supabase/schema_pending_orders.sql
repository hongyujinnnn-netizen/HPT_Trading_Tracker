-- Pending Orders System
-- Allows users to set up pending orders (Buy Stop/Sell Stop/Buy Limit/Sell Limit)
-- that auto-execute when real gold price hits entry/TP/SL

DO $$ BEGIN
  CREATE TYPE order_type AS ENUM ('buy_stop', 'sell_stop', 'buy_limit', 'sell_limit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('pending', 'active', 'closed_tp', 'closed_sl', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.pending_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol          text NOT NULL DEFAULT 'XAUUSD',
  order_type      order_type NOT NULL,
  status          order_status NOT NULL DEFAULT 'pending',
  entry_price     numeric(10,3) NOT NULL,
  stop_loss       numeric(10,3) NOT NULL,
  take_profit     numeric(10,3) NOT NULL,
  lot_size        numeric(8,2) NOT NULL CHECK (lot_size > 0),
  strategy        text,
  session         text,
  notes           text,
  expires_at      timestamptz,
  triggered_at    timestamptz,
  closed_at       timestamptz,
  triggered_price numeric(10,3),
  closed_price    numeric(10,3),
  resulting_trade_id uuid REFERENCES public.trades(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_orders" ON public.pending_orders;
CREATE POLICY "users_read_own_orders" ON public.pending_orders FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_orders" ON public.pending_orders;
CREATE POLICY "users_insert_own_orders" ON public.pending_orders FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_orders" ON public.pending_orders;
CREATE POLICY "users_update_own_orders" ON public.pending_orders FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_orders" ON public.pending_orders;
CREATE POLICY "users_delete_own_orders" ON public.pending_orders FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pending_orders_active ON public.pending_orders (status) WHERE status IN ('pending', 'active');
CREATE INDEX IF NOT EXISTS idx_pending_orders_user ON public.pending_orders (user_id);
