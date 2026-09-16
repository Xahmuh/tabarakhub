-- =============================================================================
-- ADD VEHICLE SERVICES CATEGORY AND RENAME MAINTENANCE TO BRANCH MAINTENANCE
-- =============================================================================

-- 1. Update 'Maintenance' category display name to 'Branch Maintenance'
UPDATE expense_categories
SET name = 'Branch Maintenance', updated_at = now()
WHERE slug = 'maintenance';

-- 2. Insert 'Vehicle Services' category for vehicle repairs, oil changes, etc.
INSERT INTO expense_categories (name, slug, display_order)
VALUES ('Vehicle Services', 'vehicle_services', 3)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, display_order = 3;

-- 3. Adjust display order of other categories to stay clean
UPDATE expense_categories SET display_order = 1 WHERE slug = 'fuel';
UPDATE expense_categories SET display_order = 2 WHERE slug = 'vehicle_services';
UPDATE expense_categories SET display_order = 3 WHERE slug = 'maintenance';
UPDATE expense_categories SET display_order = 4 WHERE slug = 'supplies';
UPDATE expense_categories SET display_order = 5 WHERE slug = 'other';
