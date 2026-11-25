-- Back to a clean demo state. TRUNCATE is not blocked by the append-only
-- row trigger, so this works. Re-run seed.sql afterwards.
truncate transactions, approvals, audit_log restart identity cascade;
update agents set status = 'active', token_version = 1;
