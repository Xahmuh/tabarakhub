-- Migration to add agent_name to shortages table
ALTER TABLE shortages ADD COLUMN IF NOT EXISTS agent_name TEXT;

-- Update existing shortages with agent name from products if possible
UPDATE shortages s
SET agent_name = p.agent
FROM products p
WHERE s.product_id = p.id AND s.agent_name IS NULL;

-- Default to N/A for those still NULL
UPDATE shortages SET agent_name = 'N/A' WHERE agent_name IS NULL;
