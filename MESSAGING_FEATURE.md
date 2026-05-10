# Customer-Branch Admin Messaging Feature

## Overview
A complete messaging system that allows customers to communicate directly with branch administrators.

## Features Implemented

### 1. Database Schema
- **conversations** table: Tracks conversations between customers and branches
  - Unique constraint on (customer_id, branch_id)
  - Tracks unread counts for both customer and branch
  - Last message timestamp for sorting
  
- **messages** table: Stores individual messages
  - Links to conversation and sender
  - Tracks read status
  - Includes sender role for proper display
  - Timestamps for message ordering

### 2. Backend API Routes
- `GET /api/conversations` - Get all conversations for current user
- `GET /api/conversations/:conversationId/messages` - Get messages for a conversation
- `POST /api/messages` - Send a new message
- `GET /api/messages/unread-count` - Get unread message count

### 3. Frontend Pages

#### Customer Messages (`/customer/messages`)
- View all conversations with branches
- Start new conversations by selecting a branch
- Real-time chat interface
- Unread message indicators
- Auto-refresh every 3-5 seconds
- Mobile-responsive design

#### Branch Admin Messages (`/branch/messages`)
- View all customer conversations for their branch
- See customer contact information
- Reply to customer messages
- Unread message indicators
- Real-time updates

### 4. Navigation Integration
- Added "Messages" link to customer navigation (desktop & mobile)
- Added "Messages" link to branch admin sidebar
- Unread count badges (ready for implementation)

## User Flow

### Customer Flow:
1. Customer logs in and navigates to Messages
2. Clicks "New Message" or selects existing conversation
3. Selects a branch from dropdown (for new messages)
4. Types and sends message
5. Receives replies from branch admin in real-time

### Branch Admin Flow:
1. Branch admin logs in and navigates to Messages
2. Sees list of customer conversations
3. Clicks on a conversation to view messages
4. Replies to customer messages
5. Messages are delivered in real-time

## Security Features
- Authentication required for all messaging endpoints
- Users can only access their own conversations
- Branch admins can only see messages for their assigned branch
- Proper role-based access control

## Real-Time Features
- Auto-refresh conversations every 5 seconds
- Auto-refresh messages every 3 seconds
- Automatic scroll to latest message
- Unread count updates

## Technical Details

### Database Indexes
- Optimized queries with indexes on:
  - conversation customer_id and branch_id
  - message conversation_id and created_at
  - message is_read status

### Message Marking
- Messages automatically marked as read when viewed
- Unread counts updated in real-time
- Separate unread counts for customer and branch

## Future Enhancements
- WebSocket support for true real-time messaging
- Push notifications for new messages
- Message attachments (images, files)
- Message search functionality
- Conversation archiving
- Typing indicators
- Message reactions/emojis

## Testing Checklist
- [ ] Customer can create new conversation
- [ ] Customer can send messages
- [ ] Customer can receive replies
- [ ] Branch admin can see customer messages
- [ ] Branch admin can reply to messages
- [ ] Unread counts update correctly
- [ ] Messages display in correct order
- [ ] Mobile view works properly
- [ ] Real-time updates work
- [ ] Access control works correctly

## Files Modified/Created

### Backend:
- `server/db.ts` - Added conversations and messages tables
- `server/routes/messages.ts` - New messaging API handlers
- `server/index.ts` - Registered messaging routes

### Frontend:
- `client/pages/CustomerMessages.tsx` - Customer messaging page
- `client/pages/BranchMessages.tsx` - Branch admin messaging page
- `client/App.tsx` - Added messaging routes
- `client/lib/apiClient.ts` - Added messaging API methods
- `client/components/CustomerLayout.tsx` - Added messages navigation
- `client/components/AdminLayout.tsx` - Added messages navigation

## Deployment Notes
- Database migrations will run automatically on first deployment
- No environment variables needed
- Compatible with existing authentication system
- Works with PostgreSQL (Supabase)
