# Messaging System - Complete Implementation

## Overview
A complete three-channel messaging system with proper isolation and notification badges.

## System Architecture

### Three Separate Channels

1. **Customer ↔ Branch** (`customer_id` = user ID)
   - Customers message branches
   - Branch admins reply to customers
   - Super admin CANNOT see these

2. **Admin ↔ Branch** (`customer_id` = NULL)
   - Super admin messages branches
   - Branch admins reply to admin
   - Customers CANNOT see these

3. **Complete Isolation**
   - No cross-visibility between channels
   - Separate unread counts
   - Separate notification badges

## User Roles & Access

### Customer
- **Page**: `/customer/messages`
- **Can See**: Only their conversations with branches
- **Can Do**: 
  - Message any branch
  - View replies from branch
  - Delete messages/conversations (soft delete)
- **Query**: `WHERE customer_id = $userId`

### Branch Admin
- **Page**: `/branch/messages`
- **Can See**: 
  - Customer conversations (customer_id NOT NULL)
  - Admin conversations (customer_id IS NULL)
- **Can Do**:
  - Reply to customer messages
  - Message super admin
  - Reply to admin messages
  - Delete messages/conversations (soft delete)
- **Query**: `WHERE branch_id = $branchId`

### Super Admin
- **Page**: `/admin/messages`
- **Can See**: ONLY admin-branch conversations (customer_id IS NULL)
- **Can Do**:
  - Message any branch
  - View replies from branches
  - Delete messages/conversations (soft delete)
- **Query**: `WHERE customer_id IS NULL`

## Notification Badge System

### Badge Behavior
✅ **Shows unread count** when there are unread messages
✅ **Persists** until conversation is opened
✅ **Disappears** only when user opens the specific conversation
✅ **Reappears** when new messages arrive
✅ **Updates** every 5 seconds via polling

### Badge Locations

#### Admin & Branch Admin
- **Desktop**: Sidebar "Messages" navigation item
- **Mobile**: "More" dropdown menu (for items beyond first 4)
- **Color**: Blue badge with white text
- **Animation**: Pulse effect

#### Customer
- **Desktop**: Top navigation "Messages" button
- **Mobile**: Bottom navigation "Messages" button
- **Color**: Blue badge with white text
- **Animation**: Pulse effect

### Removed Components
❌ `MessageNotificationBell` - Removed from header
❌ `MessageNotificationBanner` - Removed from below header

## Database Schema

### conversations table
```sql
id TEXT PRIMARY KEY
customer_id TEXT NULL  -- NULL = admin-branch, NOT NULL = customer-branch
branch_id TEXT NOT NULL
last_message_at TIMESTAMPTZ
customer_unread_count INTEGER  -- For customer or admin (when customer_id IS NULL)
branch_unread_count INTEGER    -- For branch admin
deleted_for JSONB              -- Soft delete tracking
created_at TIMESTAMPTZ
```

### messages table
```sql
id TEXT PRIMARY KEY
conversation_id TEXT NOT NULL
sender_id TEXT NOT NULL
sender_role TEXT NOT NULL  -- 'customer', 'branch_admin', 'admin'
message_text TEXT NOT NULL
is_read BOOLEAN
deleted_for JSONB
created_at TIMESTAMPTZ
```

## Backend API Endpoints

### GET /api/conversations
Returns conversations based on user role:
- **Customer**: `WHERE customer_id = $userId`
- **Branch Admin**: `WHERE branch_id = $branchId`
- **Admin**: `WHERE customer_id IS NULL`

### GET /api/conversations/:conversationId/messages
Returns messages for a conversation and marks them as read:
- Updates `is_read = TRUE` for messages
- Resets unread count to 0
- **This is when the badge disappears**

### POST /api/messages
Sends a message and increments unread count:
- Customer sends → `branch_unread_count++`
- Branch/Admin sends → `customer_unread_count++`
- **This is when the badge appears**

### GET /api/messages/unread-count
Returns unread count based on role:
- **Customer**: `SUM(customer_unread_count) WHERE customer_id = $userId`
- **Branch Admin**: `SUM(branch_unread_count) WHERE branch_id = $branchId`
- **Admin**: `SUM(customer_unread_count) WHERE customer_id IS NULL`

### DELETE /api/conversations/:conversationId
Soft deletes conversation (adds user ID to `deleted_for`)

### DELETE /api/messages/:messageId
Soft deletes message (adds user ID to `deleted_for`)

## Frontend Components

### Pages
1. **CustomerMessages.tsx** - Customer messaging interface
2. **BranchMessages.tsx** - Branch admin messaging interface (shows both customer & admin)
3. **AdminMessages.tsx** - Super admin messaging interface

### Layouts
1. **CustomerLayout.tsx** - Badge on Messages button (desktop & mobile)
2. **AdminLayout.tsx** - Badge on Messages sidebar item

### Features
- Real-time updates (5s polling for unread count, 3s for messages)
- Soft delete (delete for me only)
- Message timestamps
- Unread badges
- Mobile responsive
- Conversation list with last message preview
- Message input with Enter to send

## Unread Count Logic

### customer_unread_count
- **Incremented by**: Branch admin or super admin sending message
- **Read by**: Customer (when customer_id NOT NULL) or Admin (when customer_id IS NULL)
- **Reset when**: Customer/Admin opens conversation

### branch_unread_count
- **Incremented by**: Customer or super admin sending message
- **Read by**: Branch admin
- **Reset when**: Branch admin opens conversation

### For Admin-Branch Conversations
- Branch sends → `customer_unread_count++` (admin sees badge)
- Admin sends → `branch_unread_count++` (branch sees badge)

## Soft Delete Implementation

### How it works
- `deleted_for` column stores array of user IDs
- When user deletes: Add their ID to array
- When fetching: Filter out conversations/messages where user ID is in `deleted_for`
- Other party still sees the conversation/message

### Confirmation Messages
- "Delete for you? (Other party will still see it)"
- Clear indication that it's not a permanent delete

## Testing Checklist

- [x] Customer can message branch
- [x] Branch can reply to customer
- [x] Branch can message admin
- [x] Admin can message branch
- [x] Admin CANNOT see customer-branch conversations
- [x] Customer CANNOT see admin-branch conversations
- [x] Badge appears when new message arrives
- [x] Badge persists until conversation is opened
- [x] Badge disappears when conversation is opened
- [x] Badge reappears when new message arrives
- [x] Unread count is accurate for all roles
- [x] Soft delete works correctly
- [x] Mobile responsive
- [x] Real-time updates work

## Files Modified

### Backend
- `server/routes/messages.ts` - All message handlers
- `server/db.ts` - Schema with nullable customer_id
- `server/index.ts` - Message routes

### Frontend Components
- `client/components/AdminLayout.tsx` - Badge on sidebar, removed bell/banner
- `client/components/CustomerLayout.tsx` - Badge on nav, removed bell/banner
- `client/components/MessageNotificationBell.tsx` - Fixed redirect (not used anymore)
- `client/components/MessageNotificationBanner.tsx` - Fixed redirect (not used anymore)

### Frontend Pages
- `client/pages/CustomerMessages.tsx` - Customer messaging
- `client/pages/BranchMessages.tsx` - Branch messaging (both customer & admin)
- `client/pages/AdminMessages.tsx` - Admin messaging
- `client/App.tsx` - Routes for all message pages

### API Client
- `client/lib/apiClient.ts` - Message API methods

## Migration History
1. `migrate-conversations-admin-support.js` - Made customer_id nullable
2. `migrate-messages-soft-delete.js` - Added deleted_for to messages
3. `migrate-conversation-soft-delete.js` - Added deleted_for to conversations
4. `restore-conversation.js` - Restored accidentally deleted conversation

## Troubleshooting

### Badge not showing
- Check unread count query is running
- Verify conversation exists and not soft-deleted
- Check user has correct role and branch_id

### Badge not disappearing
- Verify `handleGetMessages` is called when opening conversation
- Check unread count is being reset in database
- Verify polling is working (5s interval)

### Access Denied error
- Check user is navigating to correct page for their role
- Verify MessageNotificationBell redirects to correct page
- Admin → `/admin/messages`
- Branch → `/branch/messages`
- Customer → `/customer/messages`

## Performance Notes
- Unread count polling: 5 seconds
- Messages polling: 3 seconds (when conversation is open)
- Conversations polling: 5 seconds (when on messages page)
- All queries use indexes for performance

## Security Notes
- All endpoints check user authentication
- Role-based access control on all queries
- Soft delete prevents data loss
- No cross-channel visibility
- Branch admins can only access their branch's conversations

## Future Enhancements (Optional)
- WebSocket for real-time updates (instead of polling)
- Message read receipts
- Typing indicators
- File attachments
- Message search
- Conversation archiving
- Push notifications
