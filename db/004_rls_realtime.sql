-- Row Level Security, Realtime, and locking down the SQL functions.

-- Table/function privileges for the Supabase API roles (new projects do not add these for you)
grant usage on schema public to service_role, authenticated;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
grant select on all tables in schema public to authenticated;  -- RLS below still limits rows
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
alter default privileges in schema public grant select on tables to authenticated;
-- (no grants to anon: nothing is readable without logging in)


alter table agents       enable row level security;
alter table policies     enable row level security;
alter table transactions enable row level security;
alter table approvals    enable row level security;
alter table audit_log    enable row level security;

-- Hackathon-simple: any logged-in human can read. (Production: scope by owner.)
create policy "read agents"       on agents       for select to authenticated using (true);
create policy "read policies"     on policies     for select to authenticated using (true);
create policy "read transactions" on transactions for select to authenticated using (true);
create policy "read approvals"    on approvals    for select to authenticated using (true);
create policy "read audit"        on audit_log    for select to authenticated using (true);
-- No insert/update/delete policies: only the API (service role) can write.

-- Supabase exposes public functions over its REST API. These are
-- security definer, so only the backend (service_role) may call them.
revoke execute on function append_audit(text,text,text,text,jsonb) from public, anon, authenticated;
revoke execute on function verify_audit_chain()                    from public, anon, authenticated;
revoke execute on function reserve_spend(text,bigint,text,bigint)  from public, anon, authenticated;
revoke execute on function bump_token_version(text)                from public, anon, authenticated;
grant  execute on function append_audit(text,text,text,text,jsonb) to service_role;
grant  execute on function verify_audit_chain()                    to service_role;
grant  execute on function reserve_spend(text,bigint,text,bigint)  to service_role;
grant  execute on function bump_token_version(text)                to service_role;

-- Live feed for the dashboard
alter publication supabase_realtime add table audit_log, approvals;
