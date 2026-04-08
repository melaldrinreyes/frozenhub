# Notification Badge Feature

## 🎯 Overview
Real-time notification system that alerts admins about important inventory events.

## ✨ Features

### 1. **Notification Bell Badge**
- 🔔 Bell icon in admin header
- 🔴 Red badge with count (animates for high priority)
- 🔵 Blue badge for regular notifications
- Updates every 60 seconds automatically

### 2. **Notification Types**
- ⚠️ **Out of Stock** (High Priority - Red)
  - Product quantity = 0
  - Requires immediate attention
  - Animated pulsing badge
  
- 📉 **Low Stock** (Medium Priority - Amber)
  - Product quantity ≤ reorder level
  - Needs restocking soon
  
- 📦 **New Order** (Low Priority - Blue)
  - Future: Customer orders
  
- 🔔 **System** (Info)
  - Future: System messages

### 3. **Smart Features**
- ✅ Auto-refresh every 60 seconds
- ✅ Click bell to refresh immediately
- ✅ Shows unread count (99+ if more than 99)
- ✅ Color-coded by priority
- ✅ Timestamp ("5m ago", "2h ago", "3d ago")
- ✅ Branch name badges
- ✅ Clickable to go to inventory page
- ✅ Unread indicator (blue dot)

## 🎨 UI Elements

### Notification Bell
```
[🔔] ← Click to open
 └─ [5] ← Badge shows unread count
```

### Notification Panel
```
┌─────────────────────────────────┐
│ Notifications         [5 unread] │
├─────────────────────────────────┤
│ ⚠️  Out of Stock                 │
│     Garlic is out of stock       │
│     at Bongabong Branch          │
│     2m ago        [Bongabong]    │
├─────────────────────────────────┤
│ 📉  Low Stock Alert              │
│     Pizza has 3 units remaining  │
│     5m ago        [Pinamalayan]  │
└─────────────────────────────────┘
```

## 🔧 Technical Details

### Files Created
1. **`client/hooks/use-notifications.ts`**
   - Custom React hook
   - Fetches inventory data
   - Generates notifications from low stock items
   - Returns: notifications, unreadCount, highPriorityCount

2. **`client/components/NotificationBell.tsx`**
   - Bell icon with badge
   - Slide-out notification panel
   - Color-coded notifications
   - Click handling and navigation

3. **`client/components/AdminLayout.tsx`** (Modified)
   - Added NotificationBell component
   - Shows only for admin users
   - Positioned in top bar

### Data Flow
```
Inventory API
    ↓
use-notifications hook
    ↓
Filter: quantity ≤ reorder_level
    ↓
Generate Notification objects
    ↓
NotificationBell component
    ↓
Display badge + panel
```

## 📊 Notification Object Structure
```typescript
{
  id: string;                    // "stock-inv-123"
  type: "low_stock" | "out_of_stock" | ...
  title: string;                 // "Low Stock Alert"
  message: string;               // "Pizza has 3 units..."
  read: boolean;                 // false (unread)
  priority: "low" | "medium" | "high"
  timestamp: string;             // ISO date
  action_url: string;            // "/admin/inventory"
  metadata: {
    product_id: string;
    product_name: string;
    branch_id: string;
    branch_name: string;
    quantity: number;
  }
}
```

## 🎯 Priority Levels

### High Priority (Red)
- Out of stock items
- Badge animates (pulse)
- Red background in panel

### Medium Priority (Amber)
- Low stock items
- Amber background in panel

### Low Priority (Blue)
- General notifications
- Blue background in panel

## 🚀 Usage

### For Admin Users
1. **View Notifications**
   - Look at bell icon in top-right
   - Badge shows unread count
   - Click bell to open panel

2. **Check Specific Notification**
   - Click on any notification card
   - Automatically navigates to inventory page
   - Panel closes automatically

3. **Refresh Manually**
   - Click bell icon
   - Triggers immediate refetch
   - Updates count and list

4. **Clear Notifications**
   - Currently auto-generates from inventory
   - Fix inventory → notification disappears
   - Future: Mark as read feature

## ⚡ Auto-Refresh System

### Timing
- **Refetch Interval**: 60 seconds
- **Stale Time**: 30 seconds
- **Manual Refresh**: Click bell icon

### Smart Updates
- Only fetches when data is stale
- Caches results for 30 seconds
- Background updates don't interrupt UI

## 🎨 Color Scheme

### Badge Colors
- **Red (Pulsing)**: High priority (out of stock)
- **Blue**: Regular notifications

### Panel Colors
- **Red Background**: Out of stock
- **Amber Background**: Low stock
- **Blue Background**: General info

## 📱 Responsive Design

### Desktop (≥1024px)
- Bell in top-right corner
- Panel slides from right
- 540px wide panel

### Tablet (768px-1023px)
- Bell in top bar
- Panel 400px wide

### Mobile (<768px)
- Bell in top bar
- Full-width panel

## 🔮 Future Enhancements

### Phase 2
- [ ] Mark notifications as read
- [ ] Persistent read/unread state
- [ ] Notification settings
- [ ] Sound alerts
- [ ] Desktop notifications

### Phase 3
- [ ] Real-time updates (WebSocket)
- [ ] Custom notification rules
- [ ] Email notifications
- [ ] SMS alerts for critical items

### Phase 4
- [ ] Notification history
- [ ] Filter by type
- [ ] Search notifications
- [ ] Bulk actions

## 🐛 Troubleshooting

### No Notifications Showing
**Check:**
1. Are you logged in as admin?
2. Are there low stock items?
3. Check browser console for errors

### Badge Count Wrong
**Fix:**
1. Click bell to refresh
2. Check inventory data
3. Verify filter logic

### Panel Not Opening
**Check:**
1. Console for errors
2. Sheet component imported?
3. z-index conflicts?

## 📝 Code Examples

### Using the Hook
```typescript
import { useNotifications } from "@/hooks/use-notifications";

function MyComponent() {
  const { notifications, unreadCount, refetch } = useNotifications();
  
  return (
    <div>
      Unread: {unreadCount}
      <button onClick={() => refetch()}>Refresh</button>
    </div>
  );
}
```

### Custom Notification Filter
```typescript
// Show only high priority
const critical = notifications.filter(n => n.priority === "high");

// Show only out of stock
const outOfStock = notifications.filter(n => n.type === "out_of_stock");

// Show specific branch
const branchNotifs = notifications.filter(
  n => n.metadata?.branch_id === "branch-123"
);
```

## 🎉 Benefits

### For Admin
- ✅ Instant visibility of stock issues
- ✅ No need to check inventory manually
- ✅ Prioritized alerts
- ✅ Quick navigation to action items

### For Business
- ✅ Prevent stockouts
- ✅ Improve inventory management
- ✅ Better customer service
- ✅ Reduced lost sales

### For Users
- ✅ Clean, modern UI
- ✅ Non-intrusive notifications
- ✅ Easy to understand
- ✅ Actionable information

---

**Status**: ✅ Implemented & Active
**Version**: 1.0
**Last Updated**: November 10, 2025
