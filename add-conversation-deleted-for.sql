-- Add deleted_for column to conversations table for soft delete functionality
-- This allows users to delete conversations for themselves without deleting for others

-- Add the column (JSONB array to store user IDs who deleted this conversation)
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS deleted_for JSONB DEFAULT '[]'::jsonb;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_deleted_for ON conversations USING gin(deleted_for);
