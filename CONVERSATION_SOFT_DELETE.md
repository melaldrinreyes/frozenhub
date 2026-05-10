# Conversation Soft Delete Feature

## Overview
Implemented "Delete for Me" functionality for entire conversations. Kapag nag-delete ng conversation ang isang user, nawawala lang sa kanila - yung kabilang user makikita pa rin.

## Paano Gumagana

### Database Schema
Added `deleted_for` column sa `conversations` table:
```sql
ALTER TABLE conversations 
ADD COLUMN deleted_for JSONB DEFAULT '[]'::jsonb;
```

- **Type**: JSONB array
- **Default**: Empty array `[]`
- **Purpose**: Nag-store ng user IDs ng mga nag-delete ng conversation
- **Index**: GIN index para mabilis ang query

### Soft Delete Logic

#### Kapag Nag-delete ng Conversation:
1. User clicks delete button sa conversation list
2. Confirmation: "Delete conversation with [Name] for you? (Other person will still see it)"
3. User's ID ay idinagdag sa `deleted_for` array
4. Conversation ay nakatago na sa user na yun
5. Yung kabilang user makikita pa rin ang conversation

#### Example:
```json
// Original conversation
{
  "id": "conv-123",
  "customer_id": "customer-456",
  "branch_id": "branch-789",
  "deleted_for": []
}

// After customer deletes
{
  "id": "conv-123",
  "customer_id": "customer-456",
  "branch_id": "branch-789",
  "deleted_for": ["customer-456"]
}

// After branch admin also deletes
{
  "id": "conv-123",
  "customer_id": "customer-456",
  "branch_id": "branch-789",
  "deleted_for": ["customer-456", "branch-admin-id"]
}
```

### Query Filtering
Conversations are filtered when fetching:
```sql
SELECT * FROM conversations 
WHERE customer_id = $1
  AND (deleted_for IS NULL OR NOT (deleted_for @> $2::jsonb))
ORDER BY last_message_at DESC
```

## User Experience

### Para sa Customers
1. Customer may conversation sa branch
2. Customer clicks delete button (red trash icon)
3. Confirmation: "Delete conversation with [Branch Name] for you? (Branch will still see it)"
4. Conversation disappears from customer's list
5. Branch admin still sees the conversation

### Para sa Branch Admins
1. Branch admin may conversation sa customer
2. Branch admin clicks delete button (red trash icon)
3. Confirmation: "Delete conversation with [Customer Name] for you? (Customer will still see it)"
4. Conversation disappears from branch admin's list
5. Customer still sees the conversation

## Complete Delete Functionality

### ✅ Messages (Soft Delete)
- **Location**: Inside conversation
- **Button**: Trash icon on hover (own messages only)
- **Action**: "Delete for me" - message hidden for you only
- **Confirmation**: "Delete this message for you? (Other person will still see it)"

### ✅ Conversations (Soft Delete)
- **Location**: Conversation list
- **Button**: Red trash icon on right side
- **Action**: "Delete for me" - conversation hidden for you only
- **Confirmation**: "Delete conversation with [Name] for you? (Other person will still see it)"

## Technical Details

### Backend Changes

#### 1. Database Migration
- File: `migrate-conversation-soft-delete.js`
- Adds `deleted_for` JSONB column to conversations
- Creates GIN index
- Status: ✅ Completed

#### 2. API Handler Updates
- File: `server/routes/messages.ts`
- `handleDeleteConversation`: Updates `deleted_for` array instead of DELETE
- `handleGetConversations`: Filters conversations using `NOT (deleted_for @> userId)`
- Access control: Users can delete conversations they have access to

#### 3. Database Schema
- File: `server/db.ts`
- Updated conversations table schema to include `deleted_for` column

### Frontend Changes

#### 1. Customer Messages
- File: `client/pages/CustomerMessages.tsx`
- Delete button on conversation list
- Updated confirmation message
- Toast notification on success

#### 2. Branch Messages
- File: `client/pages/BranchMessages.tsx`
- Delete button on conversation list
- Updated confirmation message
- Toast notification on success

## Security & Access Control

### Who Can Delete Conversations?
- **Customers**: Can delete their own conversations
- **Branch Admins**: Can delete conversations in their branch
- **Admins**: Can delete any conversation (system-wide)

### Validation
- User must be authenticated
- User must have access to the conversation
- User ID is added to `deleted_for` array (idempotent)
- Soft delete only - data preserved in database

## Benefits

### ✅ Privacy
- Users can clean up their conversation list
- No data loss for other party
- Each user controls their own view

### ✅ Transparency
- Clear confirmation messages
- Users know the other person still has access
- Similar to WhatsApp "Delete for Me"

### ✅ Data Integrity
- Conversations never permanently deleted
- Audit trail preserved
- Can be recovered if needed

## Comparison: Before vs After

### Before (Hard Delete)
❌ Conversation deleted for everyone
❌ Other user loses access
❌ Cannot be recovered
❌ Data loss

### After (Soft Delete)
✅ Conversation hidden only for deleting user
✅ Other user still has access
✅ Can be recovered
✅ No data loss

## Testing

### Test Scenarios

#### Scenario 1: Customer Deletes Conversation
1. Customer has conversation with Branch A
2. Branch admin sees conversation
3. Customer deletes conversation
4. Customer: Conversation gone from list
5. Branch admin: Still sees conversation
✅ PASS

#### Scenario 2: Branch Admin Deletes Conversation
1. Branch admin has conversation with Customer X
2. Customer sees conversation
3. Branch admin deletes conversation
4. Branch admin: Conversation gone from list
5. Customer: Still sees conversation
✅ PASS

#### Scenario 3: Both Delete Same Conversation
1. Both users see conversation
2. Customer deletes conversation
3. Customer: Conversation gone
4. Branch admin: Still sees conversation
5. Branch admin deletes conversation
6. Branch admin: Conversation gone
7. Database: `deleted_for: [customer-id, admin-id]`
✅ PASS

## Migration Instructions

### Run Migration
```bash
node migrate-conversation-soft-delete.js
```

### Verify
```sql
-- Check column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'conversations' 
  AND column_name = 'deleted_for';

-- Check index exists
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'conversations' 
  AND indexname = 'idx_conversations_deleted_for';
```

## Status
✅ **COMPLETE** - Conversation soft delete is fully implemented and tested.

## Files Modified

### Backend
1. `server/routes/messages.ts` - Updated delete handler and get conversations query
2. `server/db.ts` - Updated conversations table schema
3. `add-conversation-deleted-for.sql` - SQL migration file
4. `migrate-conversation-soft-delete.js` - Migration script ✅ Run successfully

### Frontend
1. `client/pages/CustomerMessages.tsx` - Updated delete confirmation
2. `client/pages/BranchMessages.tsx` - Updated delete confirmation

### Documentation
1. `CONVERSATION_SOFT_DELETE.md` - This file

## Summary

Ngayon, lahat ng delete actions ay "Delete for Me":

1. **Delete Message**: Hidden for you only, other person still sees it
2. **Delete Conversation**: Hidden for you only, other person still sees it

Walang permanent delete - lahat ay soft delete para safe at recoverable! 🎉
