# Quick Fix: Enable Users to Show Up

## The Problem
Users are not showing because the code is trying to read a `disabled` column that doesn't exist in the database yet.

## Quick Fix (Do This Now)

### Step 1: Add the Column to Database
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor"
4. Run this SQL:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT FALSE;
UPDATE users SET disabled = FALSE WHERE disabled IS NULL;
```

### Step 2: Restart Dev Server
```bash
# Stop the server (Ctrl+C)
pnpm dev
```

### Step 3: Refresh Browser
- Go to User Management page
- Users should now appear!

## That's It!
After these 3 steps, everything will work:
- ✅ Users will show up
- ✅ Disable button will work
- ✅ Enable button will work
- ✅ Disabled badge will show

The code is already complete, it just needs the database column to exist.
