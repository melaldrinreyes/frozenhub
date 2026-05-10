# Message Soft Delete Feature

## Overview
Implemented "Delete for Me" functionality for messages, similar to WhatsApp. When a user deletes a message, it only hides it for them - the other person can still see it.

## How It Works

### Database Schema
Added `deleted_for` column to the `messages` table:
```sql
ALTER TABLE messages 
ADD COLUMN deleted_for JSONB DEFAULT '[]'::jsonb;
```

- **Type**: JSONB array
- **Default**: Empty array `[]`
- **Purpose**: Stores user IDs of users who deleted this message
- **Index**: GIN index for efficient querying

### Soft Delete Logic

#### When User Deletes a Message:
1. User clicks delete button on their own message
2. Confirmation dialog: "Delete this message for you? (Other person will still see it)"
3. User's ID is added to the `deleted_for` array
4. Message is hidden from that user's view
5. Other users still see the message normally

#### Example:
```json
// Original message
{
  "id": "msg-123",
  "message_text": "Hello",
  "deleted_for": []
}

// After customer deletes it
{
  "id": "msg-123",
  "message_text": "Hello",
  "deleted_for": ["customer-user-id-456"]
}

// After branch admin also deletes it
{
  "id": "msg-123",
  "message_text": "Hello",
  "deleted_for": ["customer-user-id-456", "branch-admin-id-789"]
}
```

### Query Filtering
Messages are filtered when fetching:
```sql
SELECT * FROM messages 
WHERE conversation_id = $1
  AND NOT (deleted_for ? $2)  -- Exclude if current user ID is in deleted_for
ORDER BY created_at ASC
```

## User Experience

### For Customers
1. Customer sends message to branch
2. Customer can delete their own messages
3. Confirmation: "Delete this message for you? (Other person will still see it)"
4. Message disappears from customer's view
5. Branch admin still sees the message

### For Branch Admins
1. Branch admin receives message from customer
2. Branch admin can delete their own messages
3. Confirmation: "Delete this message for you? (Customer will still see it)"
4. Message disappears from branch admin's view
5. Customer still sees the message

## Features

### ✅ Implemented
- Soft delete for individual messages
- User can only delete their own messages
- Delete button appears on hover
- Confirmation dialog with clear explanation
- Messages filtered per user
- Database migration completed
- GIN index for performance

### 🔄 Conversation Delete
- Conversation delete still does HARD delete (removes for everyone)
- This is intentional - deleting entire conversation removes it completely

## Technical Details

### Backend Changes

#### 1. Database Migration
- File: `migrate-messages-soft-delete.js`
- Adds `deleted_for` JSONB column
- Creates GIN index for efficient queries
- Status: ✅ Completed

#### 2. API Handler Update
- File: `server/routes/messages.ts`
- `handleDeleteMessage`: Updates `deleted_for` array instead of DELETE
- `handleGetMessages`: Filters messages using `NOT (deleted_for ? userId)`
- Access control: Users can delete any message in their conversations

#### 3. Database Schema
- File: `server/db.ts`
- Updated messages table schema to include `deleted_for` column

### Frontend Changes

#### 1. Customer Messages
- File: `client/pages/CustomerMessages.tsx`
- Delete button on own messages
- Confirmation dialog with explanation
- Toast notification on success

#### 2. Branch Messages
- File: `client/pages/BranchMessages.tsx`
- Delete button on own messages
- Confirmation dialog with explanation
- Toast notification on success

## API Endpoints

### DELETE `/api/messages/:messageId`
**Purpose**: Soft delete a message (hide for current user)

**Request:**
```
DELETE /api/messages/msg-123
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Message deleted successfully"
}
```

**Behavior:**
- Adds current user's ID to `deleted_for` array
- Message hidden from current user
- Other users still see the message
- No effect on conversation metadata

## Security & Access Control

### Who Can Delete Messages?
- **Customers**: Can delete any message in their own conversations
- **Branch Admins**: Can delete any message in their branch's conversations
- **Admins**: Can delete any message (system-wide)

### Validation
- User must be authenticated
- User must have access to the conversation
- Message must exist
- User ID is added to `deleted_for` array (idempotent)

## Performance

### Query Optimization
- GIN index on `deleted_for` column
- Efficient JSONB containment operator (`?`)
- No full table scans
- Fast filtering even with many deleted messages

### Database Impact
- Minimal storage overhead (JSONB array of user IDs)
- No cascade deletes needed
- Messages remain in database for audit/recovery

## Comparison: Soft Delete vs Hard Delete

### Soft Delete (Current Implementation)
✅ Message hidden only for deleting user
✅ Other users still see it
✅ Can be recovered if needed
✅ Audit trail preserved
✅ Similar to WhatsApp "Delete for Me"

### Hard Delete (Not Implemented)
❌ Message deleted for everyone
❌ Cannot be recovered
❌ Breaks conversation flow
❌ Would need "Delete for Everyone" feature

## Future Enhancements

### Possible Additions
1. **Delete for Everyone**: Allow sender to delete message for all users (within time limit)
2. **Bulk Delete**: Delete multiple messages at once
3. **Auto-cleanup**: Permanently delete messages after X days if deleted by all parties
4. **Restore**: Allow users to restore their deleted messages
5. **Admin View**: Show deleted messages to admins with special indicator

## Testing

### Manual Testing Checklist
- [x] Customer can delete their own message
- [x] Branch admin can delete their own message
- [x] Deleted message disappears for deleting user
- [x] Deleted message still visible to other user
- [x] Confirmation dialog shows correct message
- [x] Toast notification appears on success
- [x] Multiple users can delete same message independently
- [x] Conversation list updates correctly
- [x] No errors in console
- [x] Database migration successful

### Test Scenarios

#### Scenario 1: Customer Deletes Message
1. Customer sends message: "Hello"
2. Branch admin sees: "Hello"
3. Customer deletes message
4. Customer sees: (message gone)
5. Branch admin still sees: "Hello"
✅ PASS

#### Scenario 2: Both Delete Same Message
1. Customer sends message: "Test"
2. Both users see: "Test"
3. Customer deletes message
4. Customer sees: (message gone)
5. Branch admin still sees: "Test"
6. Branch admin deletes message
7. Branch admin sees: (message gone)
8. Message still in database with `deleted_for: [customer-id, admin-id]`
✅ PASS

## Migration Instructions

### For Existing Installations
1. Run migration script:
   ```bash
   node migrate-messages-soft-delete.js
   ```

2. Verify column was added:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'messages' 
     AND column_name = 'deleted_for';
   ```

3. Check index was created:
   ```sql
   SELECT indexname 
   FROM pg_indexes 
   WHERE tablename = 'messages' 
     AND indexname = 'idx_messages_deleted_for';
   ```

### Rollback (if needed)
```sql
-- Remove index
DROP INDEX IF EXISTS idx_messages_deleted_for;

-- Remove column
ALTER TABLE messages DROP COLUMN IF EXISTS deleted_for;
```

## Status
✅ **COMPLETE** - Soft delete feature is fully implemented and tested.

## Files Modified

### Backend
1. `server/routes/messages.ts` - Updated delete handler and get messages query
2. `server/db.ts` - Updated messages table schema
3. `add-deleted-for-column.sql` - SQL migration file
4. `migrate-messages-soft-delete.js` - Migration script

### Frontend
1. `client/pages/CustomerMessages.tsx` - Updated delete confirmation
2. `client/pages/BranchMessages.tsx` - Updated delete confirmation

### Documentation
1. `MESSAGE_SOFT_DELETE.md` - This file

## Notes
- This is a "Delete for Me" feature, not "Delete for Everyone"
- Conversation delete still does hard delete (removes for everyone)
- Messages are never permanently deleted from database
- Admins can see all messages regardless of `deleted_for` status (if needed for moderation)
