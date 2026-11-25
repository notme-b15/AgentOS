-- Hash-chained, append-only audit log.

create extension if not exists pgcrypto with schema extensions;

-- ONE function used by both append and verify, so they can never disagree.
create or replace function audit_hash(
  p_prev text, p_agent text, p_action text, p_decision text,
  p_reason text, p_payload jsonb, p_ts timestamptz
) returns text language sql stable as $$
  select encode(extensions.digest(
    concat_ws('|', p_prev, coalesce(p_agent,''), p_action, p_decision,
      coalesce(p_reason,''), coalesce(p_payload::text,'{}'),
      to_char(p_ts at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US')),
    'sha256'), 'hex');
$$;

create or replace function append_audit(
  p_agent text, p_action text, p_decision text, p_reason text, p_payload jsonb
) returns audit_log language plpgsql security definer set search_path = public as $$
declare
  v_prev text;
  v_ts timestamptz := now();
  v_row audit_log;
begin
  perform pg_advisory_xact_lock(727001);                 -- serialise appends
  select hash into v_prev from audit_log order by id desc limit 1;
  v_prev := coalesce(v_prev, 'GENESIS');
  insert into audit_log(agent_id, action, decision, reason, payload, created_at, prev_hash, hash)
  values (p_agent, p_action, p_decision, p_reason, p_payload, v_ts, v_prev,
          audit_hash(v_prev, p_agent, p_action, p_decision, p_reason, p_payload, v_ts))
  returning * into v_row;
  return v_row;
end $$;

create or replace function verify_audit_chain()
returns table(valid boolean, broken_at bigint)
language plpgsql security definer set search_path = public as $$
declare r audit_log; v_prev text := 'GENESIS';
begin
  for r in select * from audit_log order by id loop
    if r.prev_hash <> v_prev
       or r.hash <> audit_hash(r.prev_hash, r.agent_id, r.action, r.decision,
                               r.reason, r.payload, r.created_at) then
      return query select false, r.id;
      return;
    end if;
    v_prev := r.hash;
  end loop;
  return query select true, null::bigint;
end $$;

-- Append-only: normal clients can never edit or delete history.
create or replace function block_audit_mutation() returns trigger
language plpgsql as $$ begin raise exception 'audit_log is append-only'; end $$;

create trigger audit_no_mutation before update or delete on audit_log
for each row execute function block_audit_mutation();
