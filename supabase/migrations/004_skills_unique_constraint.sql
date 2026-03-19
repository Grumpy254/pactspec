-- Add unique constraint on (agent_id, skill_id) required for upsert in publish route
ALTER TABLE skills ADD CONSTRAINT skills_agent_id_skill_id_key UNIQUE (agent_id, skill_id);
