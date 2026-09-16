-- HeyNikko POS V8.6.2 — Custom TWD Product Prices
-- Run ONCE in Supabase SQL Editor before using V8.6.2.
--
-- ADDITIVE ONLY. Existing SGD prices and all inventory/cloud logic stay unchanged.
-- NULL / 0 means "no custom TWD price", so the event exchange rate is used as fallback.

alter table public.products
add column if not exists twd_price numeric;

notify pgrst, 'reload schema';
