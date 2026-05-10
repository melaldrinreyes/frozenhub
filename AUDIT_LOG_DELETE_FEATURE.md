# Audit Log Delete Feature

## Overview
Added delete functionality to the Audit Logs page, allowing admins and branch admins to delete individual log entries.

## Changes Made

### Frontend Changes

#### 1. **AuditLogs.tsx** (`client/pages/AuditLogs.tsx`)
- Added `Trash2` icon import from lucide-react
- Added `AlertDialog` components import for delete confirmation
- Added state management:
  - `deleteLogId`: Tracks which log is being deleted
  - `isDeleting`: Loading state during deletion
- Added `refetch` to the logs query for refreshing after deletion
- Added `handleDeleteLog` function to handle the delete API call
- Updated table header from "Action" to "Actions"
- Added delete button in desktop table view (Actions column)
- Added delete button in mobile card view
- Added AlertDialog component for delete confirmation with:
  - Warning message
  - Cancel button
  - Delete button (red styling)
  - Loading state during deletion

### Backend Changes

#### 2. **activity-logs.ts** (`server/routes/activity-logs.ts`)
- Added `handleDeleteActivityLog` handler function with:
  - Log ID validation
  - Permission checking (branch admins can only delete their own branch logs)
  - Log existence verification
  - SQL DELETE query execution
  - Proper error handling and response

#### 3. **index.ts** (`server/index.ts`)
- Added `handleDeleteActivityLog` to imports from activity-logs route
- Registered DELETE routes:
  - `DELETE /api/activity-logs/:id`
  - `DELETE /api/audit-logs/:id`
- Both routes require authentication and admin/branch_admin role
- Applied rate limiting to prevent abuse

## Features

### Security & Permissions
- ✅ Only admins and branch admins can delete logs
- ✅ Branch admins can only delete logs from their own branch
- ✅ Admins can delete logs from any branch
- ✅ Authentication required
- ✅ Rate limiting applied

### User Experience
- ✅ Delete button with trash icon in Actions column
- ✅ Confirmation dialog before deletion
- ✅ Loading state during deletion ("Deleting..." text)
- ✅ Automatic refresh of logs after successful deletion
- ✅ Error handling with user-friendly alerts
- ✅ Red color scheme for delete button to indicate destructive action
- ✅ Works on both desktop (table view) and mobile (card view)
- ✅ Hidden in print view

### API Endpoints

#### DELETE /api/activity-logs/:id
**Authentication:** Required (admin or branch_admin)

**Parameters:**
- `id` (URL parameter): The log ID to delete

**Response:**
```json
{
  "success": true,
  "message": "Log deleted successfully"
}
```

**Error Responses:**
- `400`: Log ID is required
- `403`: Permission denied (branch admin trying to delete another branch's log)
- `404`: Log not found
- `500`: Server error

## Testing

To test the delete functionality:

1. **As Admin:**
   - Navigate to Audit Logs page
   - Click the trash icon on any log entry
   - Confirm deletion in the dialog
   - Verify the log is removed from the list

2. **As Branch Admin:**
   - Navigate to Audit Logs page
   - Click the trash icon on a log from your branch
   - Confirm deletion
   - Try to delete a log from another branch (should fail with 403)

3. **Mobile View:**
   - Access the page on mobile or narrow browser window
   - Verify delete button appears in card view
   - Test deletion works the same way

## UI Components

### Desktop View (Table)
```
| Time | User | Role | Action | Entity | Branch | Description | Actions |
|------|------|------|--------|--------|--------|-------------|---------|
| ...  | ...  | ...  | ...    | ...    | ...    | ...         | 👁️ 🗑️  |
```

### Mobile View (Card)
```
┌─────────────────────────────────┐
│ User Name                  Badge│
│ Timestamp                       │
│ Role | Branch | Entity | Name   │
│ Description                     │
│                         👁️ 🗑️   │
└─────────────────────────────────┘
```

### Delete Confirmation Dialog
```
┌─────────────────────────────────┐
│ Delete Audit Log                │
│                                 │
│ Are you sure you want to delete │
│ this audit log entry? This      │
│ action cannot be undone.        │
│                                 │
│         [Cancel]  [Delete]      │
└─────────────────────────────────┘
```

## Notes

- Deletion is permanent and cannot be undone
- Deleted logs are removed from the database immediately
- The page automatically refreshes to show updated log list
- No bulk delete functionality (only individual log deletion)
- Print view hides the delete buttons

## Future Enhancements (Optional)

- Add bulk delete functionality
- Add soft delete with restore capability
- Add audit trail for deleted logs
- Add export before delete option
- Add confirmation with log details preview
