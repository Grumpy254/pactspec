ALTER TABLE agents ADD COLUMN IF NOT EXISTS delegated_from TEXT;
CREATE INDEX IF NOT EXISTS idx_agents_delegated_from ON agents(delegated_from) WHERE delegated_from IS NOT NULL;
