-- Migration: Add ownership_type column to vehicles table
-- Allows distinguishing between Internal (Company owned) and External (Flexi driver owned) vehicles.

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ownership_type TEXT NOT NULL DEFAULT 'Internal';
