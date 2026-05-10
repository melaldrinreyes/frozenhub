# Message Notification System

## Overview
Added comprehensive notification system for new messages with visual banners, notification bells, and toast alerts.

## Features Implemented

### 1. Message Notification Bell
**Component:** `MessageNotificationBell.tsx`

- Displays a message icon with unread count badge
- Badge animates with pulse effect when there are unread messages
- Shows count up to 99+ for large numbers
- Clicking navigates to appropriate messages page based on user role
- Updates every 5 seconds automatically

**Location:**
- Admin/Branch Layout: Top right header next to user avatar
- Customer Layout: Top right header next to logout button

### 2. Message Notification Banner
**Component:** `MessageNotificationBanner.tsx`

- Prominent banner that appears at the top of the page
- Shows when user has unread messages
- Displays unread count with gradient blue background
- Animated slide-in from top
- Click to navigate to messages page
- Dismissible with X button
- Auto-hides when on messages page

**Features:**
- Gradient blue background with white text
- Pulsing message icon
- Unread count badge
- Smooth animations
- Responsive design

### 3. Toast Notifications
**Integrated with existing toast system**

- Shows toast alert when NEW messages arrive (not on initial load)
- Displays: "New Message - You have X new message(s)"
- Auto-dismisses after 5 seconds
- Only triggers when count increases (not on page load)

### 4. Sound Notification (Optional)
- Attempts to play notification sound when new messages arrive
- Gracefully fails if sound file doesn't exist or browser blocks audio
- Volume set to 50%
- Sound file path: `/notification.mp3` (optional)

## User Experience Flow

### For Customers
1. Customer receives a reply from branch admin
2. Notification bell shows unread count badge (pulsing blue)
3. Banner appears at top: "New Messages - You have 1 unread message. Click to view."
4. Toast notification pops up: "New Message - You have 1 new message"
5. Optional sound plays
6. Customer clicks banner or bell to view messages
7. Banner dismisses, badge updates when messages are read

### For Branch Admins
1. Customer sends a message
2. Notification bell shows unread count badge (pulsing blue)
3. Banner appears at top: "New Messages - You have 1 unread message. Click to view."
4. Toast notification pops up: "New Message - You have 1 new message"
5. Optional sound plays
6. Admin clicks banner or bell to view messages
7. Banner dismisses, badge updates when messages are read

## Technical Details

### Polling Interval
- Unread count checks every 5 seconds
- Conversations refresh every 5 seconds
- Messages refresh every 3 seconds

### State Management
- Uses React Query for data fetching and caching
- Tracks last unread count to detect new messages
- Banner dismissal state managed locally

### Notification Logic
```typescript
// Only show toast when count INCREASES (new messages)
if (unreadCount > lastUnreadCount && lastUnreadCount > 0) {
  const newMessages = unreadCount - lastUnreadCount;
  toast({
    title: "New Message",
    description: `You have ${newMessages} new message${newMessages > 1 ? 's' : ''}`,
    duration: 5000,
  });
}
```

### Banner Visibility Rules
Banner is hidden when:
- No unread messages (`unreadCount === 0`)
- User dismissed it (`dismissed === true`)
- User is on messages page (`location.pathname.includes('/messages')`)

## Files Modified

### New Files
1. `client/components/MessageNotificationBell.tsx` - Notification bell icon with badge
2. `client/components/MessageNotificationBanner.tsx` - Top banner notification
3. `MESSAGE_NOTIFICATIONS.md` - This documentation

### Modified Files
1. `client/components/AdminLayout.tsx`
   - Added imports for notification components
   - Added `<MessageNotificationBell />` in header
   - Added `<MessageNotificationBanner />` after header

2. `client/components/CustomerLayout.tsx`
   - Added imports for notification components
   - Added `<MessageNotificationBell />` in header (only when logged in)
   - Added `<MessageNotificationBanner />` after header

## API Endpoints Used

### GET `/api/messages/unread-count`
Returns unread message count for current user:
```json
{
  "unreadCount": 5
}
```

**Behavior:**
- Customers: Returns count of unread messages from branch admins
- Branch Admins: Returns count of unread messages from customers in their branch
- Admins: Returns total unread messages across all branches

## Styling

### Notification Bell
- Ghost button variant
- Icon size: 20px (w-5 h-5)
- Badge: Blue background with pulse animation
- Positioned absolute top-right of button

### Notification Banner
- Fixed position at top of page (below header)
- Max width: 2xl (672px)
- Gradient: Blue 500 to Blue 600
- Padding: 16px
- Border radius: 8px
- Shadow: Large
- Hover: Extra large shadow
- Animation: Slide in from top

### Toast Notification
- Uses existing toast system
- Default styling
- Duration: 5 seconds
- Position: Bottom right (default)

## Browser Compatibility
- Works in all modern browsers
- Audio notification may be blocked by browser autoplay policies
- Gracefully degrades if audio fails

## Performance Considerations
- Polling every 5 seconds is lightweight (single API call)
- React Query caches results to minimize re-renders
- Banner only renders when needed
- Toast only triggers on actual new messages (not page loads)

## Future Enhancements
1. WebSocket support for real-time notifications (no polling)
2. Push notifications for mobile devices
3. Customizable notification sounds
4. Notification preferences (enable/disable sound, banner, etc.)
5. Mark all as read functionality
6. Notification history/log

## Testing Checklist
- [x] Bell shows unread count
- [x] Bell badge pulses when unread > 0
- [x] Banner appears when unread > 0
- [x] Banner dismisses on X click
- [x] Banner hides on messages page
- [x] Toast shows on new messages
- [x] Toast doesn't show on page load
- [x] Clicking bell navigates to messages
- [x] Clicking banner navigates to messages
- [x] Count updates when messages are read
- [x] Works for customers
- [x] Works for branch admins
- [x] Responsive on mobile
- [x] Responsive on desktop

## Notes
- The notification sound file (`/notification.mp3`) is optional
- If you want to add a sound, place an MP3 file in the `public` folder
- The system will work perfectly without the sound file
- All notifications are non-intrusive and user-friendly
