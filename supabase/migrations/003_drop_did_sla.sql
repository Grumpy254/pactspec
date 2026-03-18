-- Migration 003: drop DID and SLA columns
-- These were decorative/unverifiable metadata that created false confidence.
-- provider_did: DID resolution is not implemented — field served no function.
-- sla_p99_ms / sla_uptime: self-declared numbers with no monitoring or enforcement.

ALTER TABLE agents DROP COLUMN IF EXISTS provider_did;
ALTER TABLE skills DROP COLUMN IF EXISTS sla_p99_ms;
ALTER TABLE skills DROP COLUMN IF EXISTS sla_uptime;
