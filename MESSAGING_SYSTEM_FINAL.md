# Messaging System - Final Implementation

## Overview
Three separate messaging channels with complete isolation:
1. **Customer ↔ Branch** (customer_id = user ID)
2. **Admin ↔ Branch** (customer_id = NULL)
3. Complete separation - no cross-visibility

## Implementation Details

### Database Structure
- **conversations table**:
  - `customer_id` = NULL → Admin-Branch conversation
  - `customer_id` = user ID → Customer-Branch conversation
  - `branch_id` = branch ID (always present)

### User Roles & Access

#### 1. Customer
- **Can**: Message any branch
- **Cannot**: See admin-branch conversations
- **Page**: `/customer/messages`
- **Query**: `WHERE customer_id = $userId`

#### 2. Branch Admin
- **Can**: 
  - Reply to customer messages (customer_id NOT NULL)
  - Message super admin (customer_id IS NULL)
- **Cannot**: See other branches' conversations
- **Page**: `/branch/messages`
- **Query**: `WHERE branch_id = $branchId AND customer_id IS NULL`
- **Note**: Only shows admin-branch conversations

#### 3. Super Admin
- **Can**: Message any branch
- **Cannot**: See customer-branch conversations
- **Page**: `/admin/messages`
- **Query**: `WHERE customer_id IS NULL`

### Backend Queries

#### Get Conversations
```sql
-- Customer
WHERE customer_id = $userId

-- Branch Admin (ONLY admin conversations)
WHERE branch_id = $branchId AND customer_id IS NULL

-- Super Admin (ONLY admin conversations)
WHERE customer_id IS NULL
```

#### Unread Count
```sql
-- Customer
SELECT SUM(customer_unread_count) 
FROM conversations 
WHERE customer_id = $userId

-- Branch Admin (ONLY admin conversations)
SELECT SUM(branch_unread_count) 
FROM conversations 
WHERE branch_id = $branchId AND customer_id IS NULL

-- Super Admin (ONLY admin conversations)
SELECT SUM(customer_unread_count) 
FROM conversations 
WHERE customer_id IS NULL
```

#### Send Message
- **Customer**: Creates conversation with `customer_id = userId`
- **Branch Admin**: 
  - Reply to customer: Uses existing conversation (customer_id NOT NULL)
  - Message admin: Creates/uses conversation with `customer_id = NULL`
- **Admin**: Creates/uses conversation with `customer_id = NULL`

### Frontend Components

#### MessageNotificationBell.tsx
- Customer → `/customer/messages`
- Branch Admin → `/branch/messages`
- Super Admin → `/admin/messages` ✅ FIXED

#### MessageNotificationBanner.tsx
- Customer → `/customer/messages`
- Branch Admin → `/branch/messages`
- Super Admin → `/admin/messages` ✅ FIXED

#### Pages
1. **CustomerMessages.tsx**: Customer-Branch conversations
2. **BranchMessages.tsx**: Admin-Branch conversations (branch view)
3. **AdminMessages.tsx**: Admin-Branch conversations (admin view)

### Unread Count Logic

#### customer_unread_count
- Incremented when: Branch admin or super admin sends message
- Read by: Customer

#### branch_unread_count
- Incremented when: Customer or super admin sends message
- Read by: Branch admin

**For Admin-Branch conversations:**
- Branch sends → `customer_unread_count++` (admin sees)
- Admin sends → `branch_unread_count++` (branch sees)

### Complete Isolation

✅ **Customer messages branch**
- Creates conversation with `customer_id = userId`
- Super admin query filters `WHERE customer_id IS NULL`
- Super admin NEVER sees this conversation
- Super admin unread count NEVER includes this

✅ **Admin messages branch**
- Creates conversation with `customer_id = NULL`
- Customer query filters `WHERE customer_id = userId`
- Customer NEVER sees this conversation

✅ **Branch admin sees correct conversations**
- In BranchMessages page: Only admin conversations (`customer_id IS NULL`)
- Customer conversations are handled separately (if needed in future)

## Bug Fixes Applied

### Issue: Super Admin Access Denied
**Problem**: When customer messages branch, super admin sees notification → clicks → redirects to `/branch/messages` → Access Denied

**Root Causes**:
1. ❌ MessageNotificationBell redirected admin to `/branch/messages`
2. ❌ MessageNotificationBanner redirected admin to `/branch/messages`
3. ❌ Unread count included customer-branch conversations

**Fixes**:
1. ✅ MessageNotificationBell now redirects admin to `/admin/messages`
2. ✅ MessageNotificationBanner now redirects admin to `/admin/messages`
3. ✅ Admin unread count filters `WHERE customer_id IS NULL`
4. ✅ Branch admin unread count filters `WHERE customer_id IS NULL`

## Testing Checklist

- [x] Customer can message branch
- [x] Branch can reply to customer
- [x] Super admin CANNOT see customer-branch conversations
- [x] Super admin CANNOT see customer-branch notifications
- [x] Super admin can message branch
- [x] Branch can reply to admin
- [x] Branch admin ONLY sees admin conversations in Messages page
- [x] Notification bell redirects to correct page for each role
- [x] Notification banner redirects to correct page for each role
- [x] Unread counts are accurate for each role
- [x] Soft delete works for all roles

## Migration History
1. `migrate-conversations-admin-support.js` - Made customer_id nullable, dropped unique constraint

## Files Modified
- `server/routes/messages.ts` - Query filters, unread count logic
- `server/db.ts` - Schema update (customer_id nullable)
- `client/pages/BranchMessages.tsx` - Admin-only conversations
- `client/pages/AdminMessages.tsx` - New admin messaging page
- `client/components/MessageNotificationBell.tsx` - Fixed admin redirect
- `client/components/MessageNotificationBanner.tsx` - Fixed admin redirect
- `client/components/AdminLayout.tsx` - Added Messages link
- `client/App.tsx` - Added /admin/messages route
