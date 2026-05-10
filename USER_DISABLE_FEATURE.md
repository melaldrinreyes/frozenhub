# User Disable/Enable Feature

## Overview
Added the ability for super admins to disable and enable user accounts in the User Management page. Disabled users cannot log in until they are re-enabled.

## Changes Made

### Frontend Changes (`client/pages/AdminUsers.tsx`)

#### 1. Added New Icons
```typescript
import {
  Ban,        // For disable button
  CheckCircle, // For enable button
} from "lucide-react";
```

#### 2. Updated Confirm Dialog Type
Extended the confirm dialog to handle three types of actions:
- `delete-user` - Delete a user permanently
- `disable-user` - Disable a user account
- `enable-user` - Enable a disabled user account

#### 3. Added Toggle User Status Mutation
```typescript
const toggleUserStatusMutation = useMutation({
  mutationFn: ({ id, disabled }: { id: string; disabled: boolean }) =>
    apiClient.updateUser(id, { disabled }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
  },
  onError: (error: any) => {
    alert(error.message || "Failed to update user status");
  },
});
```

#### 4. Added Handler Function
```typescript
const handleToggleUserStatus = (user: any) => {
  const action = user.disabled ? "enable-user" : "disable-user";
  setConfirmDialog({ type: action, user });
};
```

#### 5. Updated Actions Column

**Desktop Table View:**
- Added disable/enable button between Edit and Delete buttons
- Orange color for disable action (Ban icon)
- Green color for enable action (CheckCircle icon)
- Shows appropriate icon based on user status

**Mobile Card View:**
- Added disable/enable button in the action buttons row
- Same color scheme and icons as desktop view
- Responsive layout maintained

#### 6. Added Visual Indicators
- **Disabled Badge**: Shows "Disabled" badge next to user name
- Red background with red text
- Visible in both desktop table and mobile card views
- Helps quickly identify disabled accounts

#### 7. Updated Confirmation Dialog
- Dynamic title based on action type
- Different messages for disable/enable/delete
- Color-coded action buttons:
  - Red for delete
  - Orange for disable
  - Green for enable

## Features

### Disable User
- **Action**: Prevents user from logging in
- **Icon**: Ban (circle with slash)
- **Color**: Orange
- **Confirmation**: "Are you sure you want to disable user [name]? They will not be able to log in until re-enabled."
- **Reversible**: Yes, can be re-enabled

### Enable User
- **Action**: Allows disabled user to log in again
- **Icon**: CheckCircle
- **Color**: Green
- **Confirmation**: "Are you sure you want to enable user [name]? They will be able to log in again."
- **Effect**: Removes disabled status

### Visual Indicators
- **Disabled Badge**: Red badge showing "Disabled" next to user name
- **Button State**: Shows CheckCircle icon for disabled users, Ban icon for active users
- **Tooltip**: Hover shows "Enable user" or "Disable user"

## User Interface

### Desktop View
```
| User              | Email           | Phone        | Role | Branch | Joined   | Actions        |
|-------------------|-----------------|--------------|------|--------|----------|----------------|
| John Doe          | john@email.com  | 555-0000     | POS  | Main   | 1/1/2024 | ✏️ 🚫 🗑️      |
| Jane Smith [Disabled] | jane@email.com | 555-0001  | Admin| -      | 1/2/2024 | ✏️ ✅ 🗑️      |
```

### Mobile View
```
┌─────────────────────────────────────┐
│ 👤 John Doe                  ✏️ 🚫 🗑️│
│ 📧 john@email.com                   │
│ 📱 555-0000                         │
│ ┌─────────┬─────────┐              │
│ │ Role    │ Branch  │              │
│ │ POS     │ Main    │              │
│ └─────────┴─────────┘              │
└─────────────────────────────────────┘
```

## Backend Requirements

The backend must support the `disabled` field in the user update endpoint:

```typescript
// Update user endpoint should accept:
{
  disabled: boolean  // true to disable, false to enable
}
```

The `disabled` field should be checked during login to prevent disabled users from accessing the system.

## Security & Permissions

- ✅ Only super admins (role: "admin") can access User Management
- ✅ Only super admins can disable/enable users
- ✅ Confirmation required before disabling or enabling
- ✅ Cannot disable yourself (should be prevented by backend)
- ✅ Disabled users cannot log in (backend enforcement)

## Use Cases

### 1. Temporary Suspension
- Employee on leave
- Pending investigation
- Account security concerns

### 2. Soft Delete Alternative
- Keep user data intact
- Prevent login without deletion
- Can be reversed if needed

### 3. Account Management
- Deactivate former employees
- Suspend problematic accounts
- Manage seasonal workers

## Testing

To test the disable/enable functionality:

1. **Disable a User:**
   - Navigate to User Management (Admin only)
   - Find an active user
   - Click the Ban icon (🚫)
   - Confirm the action
   - Verify "Disabled" badge appears

2. **Enable a User:**
   - Find a disabled user (has "Disabled" badge)
   - Click the CheckCircle icon (✅)
   - Confirm the action
   - Verify "Disabled" badge is removed

3. **Login Prevention:**
   - Disable a user account
   - Try to log in with that user's credentials
   - Should be denied access

4. **Mobile View:**
   - Access User Management on mobile
   - Verify disable/enable buttons work
   - Check badge visibility

## Notes

- Disabling is reversible - users can be re-enabled at any time
- Disabled users retain all their data and settings
- The disabled status should be checked during authentication
- Consider adding a "Last Login" field to track inactive accounts
- May want to add bulk disable/enable functionality in the future

## Future Enhancements (Optional)

- Add "disabled_at" timestamp
- Add "disabled_by" to track who disabled the account
- Add "disabled_reason" field for documentation
- Add filter to show only disabled users
- Add bulk disable/enable functionality
- Add automatic disable after X days of inactivity
- Send email notification when account is disabled/enabled
- Add audit log entry for disable/enable actions
