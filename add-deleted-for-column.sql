-- Add deleted_for column to messages table for soft delete functionality
-- This allows users to delete messages for themselves without deleting for others

-- Add the column (JSONB array to store user IDs who deleted this message)
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS deleted_for JSONB DEFAULT '[]'::jsonb;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_deleted_for ON messages USING gin(deleted_for);

-- Example usage:
-- When customer deletes a message: UPDATE messages SET deleted_for = deleted_for || '["customer-user-id"]'::jsonb WHERE id = 'msg-id';
-- When branch admin deletes: UPDATE messages SET deleted_for = deleted_for || '["branch-admin-user-id"]'::jsonb WHERE id = 'msg-id';
-- Query to exclude deleted messages: SELECT * FROM messages WHERE NOT (deleted_for ? 'current-user-id');
