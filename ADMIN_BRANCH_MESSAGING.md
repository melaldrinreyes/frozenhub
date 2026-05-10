# Admin-Branch Messaging Feature

## Overview
This feature enables bidirectional messaging between Super Admin and Branch Admins, in addition to the existing Customer-Branch messaging system.

## Implementation Details

### Database Changes
- **conversations table**: Modified `customer_id` column to be nullable (was NOT NULL)
- **Removed constraint**: Dropped `unique_customer_branch` constraint to allow multiple conversation types
- **Admin conversations**: When `customer_id` IS NULL, the conversation is between Admin and Branch

### Backend Changes (server/routes/messages.ts)

#### Get Conversations
- **Admin**: Fetches conversations where `customer_id IS NULL` (admin-branch conversations)
- **Branch Admin**: Fetches all conversations for their branch (both customer and admin conversations)
- **Customer**: Fetches their own conversations with branches (unchanged)

#### Send Message
- **Admin**: Can create new conversations with branches (customer_id = NULL)
- **Branch Admin**: Can reply to both customer and admin conversations
- **Customer**: Can create conversations with branches (unchanged)

#### Display Logic
- When `customer_id IS NULL`, the conversation shows "Admin" as the customer name
- Branch admins see "Admin" in their conversation list for admin conversations
- Super admin sees branch names in their conversation list

### Frontend Changes

#### AdminMessages.tsx (New)
- Super admin page for messaging branches
- Lists all admin-branch conversations
- Can start new conversations with any branch
- Shows branch name and location
- Soft delete for conversations and messages

#### BranchMessages.tsx (Updated)
- Now displays both customer and admin conversations
- Shows "Admin" for admin conversations
- Updated delete confirmations to handle both types
- Proper icon display (User icon for customers, Building2 for admin context)

#### AdminLayout.tsx (Updated)
- Added "Messages" navigation link for super admin
- Positioned between "Audit Logs" and "CMS"

#### App.tsx (Updated)
- Added route `/admin/messages` for AdminMessages component
- Protected with admin role

### Migration
- **File**: `migrate-conversations-admin-support.js`
- **Actions**:
  1. Drops `unique_customer_branch` constraint
  2. Makes `customer_id` nullable
- **Status**: ✅ Successfully executed

## User Experience

### Super Admin
1. Navigate to "Messages" in sidebar
2. View list of conversations with branches
3. Click "New Message" to start conversation with a branch
4. Select branch from dropdown
5. Type message and send
6. View conversation history
7. Delete messages/conversations (soft delete - branch still sees them)

### Branch Admin
1. Navigate to "Messages" in sidebar
2. View list of all conversations (customers + admin)
3. Conversations with admin show "Admin" as the name
4. Click conversation to view messages
5. Reply to messages
6. Delete messages/conversations (soft delete - other party still sees them)

### Customer
- No changes to customer experience
- Continues to message branches as before

## Soft Delete Behavior
- When admin deletes a conversation/message, it's hidden only for admin
- When branch admin deletes a conversation/message, it's hidden only for that branch admin
- The other party still sees the conversation/message
- Uses `deleted_for` JSONB column to track who deleted what

## Testing Checklist
- [x] Database migration successful
- [x] Admin can create conversation with branch
- [x] Admin can send messages to branch
- [x] Branch admin can see admin conversations
- [x] Branch admin can reply to admin
- [x] Soft delete works for admin
- [x] Soft delete works for branch admin
- [x] Real-time updates work (polling every 3-5 seconds)
- [x] Mobile responsive layout
- [x] Proper spacing and back buttons

## Technical Notes
- Uses PostgreSQL JSONB for `deleted_for` tracking
- Polling intervals: 5s for conversations, 3s for messages
- Customer conversations still use the original flow (customer_id NOT NULL)
- Admin conversations use customer_id = NULL to differentiate
