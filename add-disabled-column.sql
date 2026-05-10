-- Add disabled column to users table
-- Run this SQL script in your Supabase SQL Editor

-- Check if column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'disabled'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN disabled BOOLEAN DEFAULT FALSE;
        
        RAISE NOTICE 'Column "disabled" added to users table';
    ELSE
        RAISE NOTICE 'Column "disabled" already exists';
    END IF;
END $$;

-- Set all existing users to enabled (not disabled)
UPDATE users SET disabled = FALSE WHERE disabled IS NULL;

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'disabled';
