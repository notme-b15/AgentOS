-- DEMO ONLY: simulate an attacker with database access quietly rewriting history.
-- Run in the SQL Editor, then press "Verify audit log" in the dashboard.
alter table audit_log disable trigger audit_no_mutation;
update audit_log set reason = 'ok', decision = 'allowed' where id = 2;
alter table audit_log enable trigger audit_no_mutation;

-- To check without the dashboard:
-- select * from verify_audit_chain();   -- valid = false, broken_at = 2
