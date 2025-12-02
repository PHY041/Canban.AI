-- Migration: Add soft delete support
-- Run this in Supabase SQL Editor

-- Add is_active column to boards
ALTER TABLE boards ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add is_active column to cards
ALTER TABLE cards ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_boards_is_active ON boards(is_active);
CREATE INDEX IF NOT EXISTS idx_cards_is_active ON cards(is_active);

-- Update existing rows to be active
UPDATE boards SET is_active = true WHERE is_active IS NULL;
UPDATE cards SET is_active = true WHERE is_active IS NULL;

