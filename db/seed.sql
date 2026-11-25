-- Demo data. Run ONCE (run reset.sql first if you need to re-seed).
-- Demo policy: Rs 5,000 per transaction, Rs 15,000 per day, approval above Rs 4,000.

insert into agents (id, name, owner) values
  ('agent_shop_01',   'Shopping Agent', 'owner@example.com'),
  ('agent_travel_01', 'Travel Agent',   'owner@example.com')
on conflict (id) do nothing;

insert into policies (agent_id, scopes, max_per_txn, daily_budget, approval_threshold) values
  ('agent_shop_01',   array['search_products','purchase','check_budget'], 500000, 1500000, 400000),
  ('agent_travel_01', array['check_budget'],                              300000,  600000, 200000)
on conflict (agent_id) do nothing;

-- History from earlier days (so today's budget starts clean)
insert into transactions (agent_id, amount, merchant, status, created_at) values
  ('agent_shop_01', 50000, 'Campus Store', 'approved', now() - interval '2 days');

-- Audit history goes through append_audit so the hash chain is valid
select append_audit('agent_shop_01',   'purchase',        'allowed', 'ok',
  '{"product_id":"p_notebook","amount":50000}'::jsonb);
select append_audit('agent_shop_01',   'purchase',        'blocked', 'exceeds_per_txn_limit',
  '{"product_id":"p_monitor","detail":"800000 > 500000"}'::jsonb);
select append_audit('agent_travel_01', 'search_products', 'blocked', 'action_not_permitted',
  '{}'::jsonb);
