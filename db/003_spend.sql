-- Atomic budget enforcement and passport versioning.

create or replace function reserve_spend(
  p_agent text, p_amount bigint, p_merchant text, p_budget bigint
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_spent bigint; v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_agent));       -- per-agent lock
  select coalesce(sum(amount), 0) into v_spent from transactions
   where agent_id = p_agent and status = 'approved'
     and created_at >= date_trunc('day', now());
  if v_spent + p_amount > p_budget then
    return null;                                           -- over budget
  end if;
  insert into transactions(agent_id, amount, merchant, status)
  values (p_agent, p_amount, p_merchant, 'approved') returning id into v_id;
  return v_id;
end $$;

create or replace function bump_token_version(p_agent text)
returns int language sql security definer set search_path = public as $$
  update agents set token_version = token_version + 1
  where id = p_agent returning token_version;
$$;
