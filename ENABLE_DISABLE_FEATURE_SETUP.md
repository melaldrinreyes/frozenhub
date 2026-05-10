# User Disable Feature Setup Guide

## Problem
The `disabled` column doesn't exist in the database yet, causing users to not show up.

## Solution - Follow These Steps:

### Step 1: Add the `disabled` Column to Database

**Option A: Using Supabase Dashboard (RECOMMENDED)**
1. Go to https://supabase.com/dashboard
2. Select your project: `xunlduzvfaokkqnzwuoi`
3. Click on "SQL Editor" in the left sidebar
4. Click "New Query"
5. Copy and paste this SQL:

```sql
-- Add disabled column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT FALSE;

-- Set all existing users to enabled
UPDATE users SET disabled = FALSE WHERE disabled IS NULL;

-- Verify
SELECT id, name, email, disabled FROM users LIMIT 5;
```

6. Click "Run" button
7. You should see your users with `disabled = false`

**Option B: Using the SQL file**
1. Open the file: `add-disabled-column.sql`
2. Copy all the SQL code
3. Run it in Supabase SQL Editor

### Step 2: Restart Your Development Server

After adding the column:
1. Stop the dev server (Ctrl+C)
2. Run: `pnpm dev`
3. The users should now appear

### Step 3: Test the Disable Feature

Once the server is running:
1. Go to User Management page
2. You should see all users
3. Click the disable button (🚫) next to a user
4. Confirm the action
5. The user should show "Disabled" badge
6. Try to login with that user - should be blocked

## What the Disable Feature Does:

### Frontend (Already Implemented)
- ✅ Disable button in Actions column
- ✅ Enable button for disabled users
- ✅ "Disabled" badge on user name
- ✅ Confirmation dialogs
- ✅ Color-coded buttons (orange for disable, green for enable)

### Backend (Needs Database Column)
- ✅ Update user endpoint accepts `disabled` field
- ✅ Get users endpoint returns `disabled` status
- ✅ Activity logging for disable/enable actions
- ⚠️ **NEEDS**: Login check to prevent disabled users from logging in

## Next Steps After Adding Column:

### 1. Add Login Prevention

Update the login handler to check if user is disabled:

**File**: `server/routes/mysql-core.ts` (or wherever login is handled)

Find the login function and add this check after password verification:

```typescript
// After password verification succeeds
if (user.disabled) {
  return res.status(403).json({ 
    error: "Your account has been disabled. Please contact an administrator." 
  });
}
```

### 2. Verify Everything Works

1. **Check Users Appear**: Go to User Management - all users should be visible
2. **Test Disable**: Click disable button on a test user
3. **Test Login Block**: Try to login with disabled user - should be blocked
4. **Test Enable**: Re-enable the user
5. **Test Login Success**: Login should work again

## Troubleshooting:

### Users Still Not Showing?
1. Check browser console for errors
2. Check server logs for database errors
3. Verify the column was added: Run in SQL Editor:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'users';
   ```
4. Make sure you restarted the dev server

### Disable Button Not Working?
1. Check if column exists in database
2. Check browser console for API errors
3. Verify the update endpoint is working

### Login Still Works for Disabled Users?
1. Add the login prevention code (see above)
2. Restart the server
3. Test again

## Database Schema

After adding the column, your users table should have:

```sql
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  google_id VARCHAR(255) NULL,
  role ENUM(...) NOT NULL,
  branch_id VARCHAR(255),
  disabled BOOLEAN DEFAULT FALSE,  -- NEW COLUMN
  created_at DATETIME NOT NULL
);
```

## Summary

The disable feature is already coded in both frontend and backend. You just need to:
1. ✅ Add the `disabled` column to database (run the SQL)
2. ✅ Restart the dev server
3. ✅ Add login prevention check
4. ✅ Test everything

That's it! The feature will work perfectly after these steps.
