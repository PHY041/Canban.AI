-- Kanban AI Database Schema for Supabase
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Boards table
CREATE TABLE IF NOT EXISTS boards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#6366f1',
    position INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cards table
CREATE TABLE IF NOT EXISTS cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
    priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
    priority_reason TEXT,
    estimated_hours DECIMAL,
    actual_hours DECIMAL,
    deadline TIMESTAMPTZ,
    position INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity logs table (for future screenpipe integration)
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) CHECK (activity_type IN ('screen_time', 'status_change', 'edit', 'priority_change')),
    duration_minutes INTEGER,
    context TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Priority history table
CREATE TABLE IF NOT EXISTS priority_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
    old_priority INTEGER,
    new_priority INTEGER NOT NULL,
    reasoning TEXT,
    model_used VARCHAR(100),
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cards_board_id ON cards(board_id);
CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);
CREATE INDEX IF NOT EXISTS idx_cards_priority ON cards(priority);
CREATE INDEX IF NOT EXISTS idx_cards_deadline ON cards(deadline);
CREATE INDEX IF NOT EXISTS idx_activity_logs_card_id ON activity_logs(card_id);
CREATE INDEX IF NOT EXISTS idx_priority_history_card_id ON priority_history(card_id);

-- Insert default boards (your 7 workstreams)
INSERT INTO boards (name, description, color, position) VALUES
    ('Work (canmarket.ai)', 'canmarket.ai startup work', '#ef4444', 0),
    ('Research - Stanford', 'Stanford research (Tuesdays)', '#f97316', 1),
    ('Research - Mobile/Android', 'Mobile/Android research (Wednesdays)', '#eab308', 2),
    ('Module 1', 'University course 1', '#22c55e', 3),
    ('Module 2', 'University course 2', '#14b8a6', 4),
    ('Module 3', 'University course 3', '#3b82f6', 5),
    ('Module 4', 'University course 4', '#8b5cf6', 6),
    ('Module 5', 'University course 5', '#ec4899', 7),
    ('Module 6', 'University course 6', '#6366f1', 8)
ON CONFLICT DO NOTHING;

-- Row Level Security (RLS) - Enable if you want user authentication later
-- ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE priority_history ENABLE ROW LEVEL SECURITY;
