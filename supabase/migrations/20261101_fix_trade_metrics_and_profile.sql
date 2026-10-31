-- =====================================================================
-- Migration: Preserve MT5 Net PnL & Planned RR in trg_calculate_trade_metrics
-- =====================================================================

create or replace function public.trg_calculate_trade_metrics()
returns trigger
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract_size numeric(10,2);
begin
  select contract_size into v_contract_size
  from public.user_settings
  where user_id = new.user_id;

  v_contract_size := coalesce(v_contract_size, 100);

  if new.stop_loss is not null and new.stop_loss > 0 then
    new.risk_amount := abs(new.entry_price - new.stop_loss) * new.lot_size * v_contract_size;
  else
    new.risk_amount := null;
  end if;

  if new.status = 'closed' and new.exit_price is not null then
    if new.pnl is null then
      if new.side = 'buy' then
        new.pnl := (new.exit_price - new.entry_price) * new.lot_size * v_contract_size;
      else
        new.pnl := (new.entry_price - new.exit_price) * new.lot_size * v_contract_size;
      end if;
    end if;
  elsif new.status = 'open' then
    new.pnl := null;
  end if;

  if new.rr_ratio is null or new.rr_ratio = 0 then
    if new.take_profit is not null and new.take_profit > 0 and new.stop_loss is not null and new.stop_loss > 0 and abs(new.entry_price - new.stop_loss) > 0 then
      new.rr_ratio := round(abs(new.take_profit - new.entry_price) / abs(new.entry_price - new.stop_loss), 2);
    elsif new.pnl is not null and new.risk_amount is not null and new.risk_amount > 0 then
      new.rr_ratio := round(abs(new.pnl) / new.risk_amount, 2);
    else
      new.rr_ratio := null;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$ language plpgsql;
