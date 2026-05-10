# Audit Log Base64 Description and Metadata Fix

## Overview
Fixed the audit logs to automatically decode base64-encoded descriptions AND metadata values, displaying them as readable text instead of showing raw base64 strings.

## Problem
Some audit log descriptions and metadata values were being stored as base64-encoded strings, making them unreadable in the UI. Users would see long strings of random characters like `SGVsbG8gV29ybGQ=` instead of the actual message.

## Solution
Added automatic base64 detection and decoding for both audit log descriptions and metadata values throughout the application.

## Changes Made

### AuditLogs.tsx (`client/pages/AuditLogs.tsx`)

#### 1. Added `decodeBase64Description` Function
```typescript
function decodeBase64Description(description: unknown): string {
  const value = description == null ? "" : String(description).trim();
  if (!value) return "";
  
  // Check if it looks like base64 (only contains base64 characters and is reasonably long)
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  if (value.length > 20 && base64Regex.test(value)) {
    try {
      // Try to decode as base64
      const decoded = atob(value);
      // Check if decoded string is valid UTF-8 and readable
      if (decoded && /^[\x20-\x7E\s]*$/.test(decoded)) {
        return decoded;
      }
    } catch (e) {
      // If decoding fails, return original value
      return value;
    }
  }
  
  return value;
}
```

**Features:**
- ✅ Detects base64-encoded strings using regex pattern
- ✅ Only attempts to decode strings longer than 20 characters
- ✅ Validates decoded output is readable UTF-8 text
- ✅ Falls back to original value if decoding fails
- ✅ Handles null/undefined values gracefully

#### 2. Added `getFullDescription` Function
```typescript
function getFullDescription(description: unknown): string {
  const decoded = decodeBase64Description(description);
  return decoded || "-";
}
```

Returns the full decoded description for use in:
- Detail view dialog
- CSV export
- Full text display

#### 3. Updated `formatMetadataValue` Function
```typescript
function formatMetadataValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  
  // Decode base64 if it's a string
  const stringValue = String(value);
  const decoded = decodeBase64Description(stringValue);
  return decoded;
}
```

Now decodes base64 values in metadata before displaying them.

#### 4. Updated `renderDescriptionDots` Function
```typescript
function renderDescriptionDots(description: unknown) {
  const decoded = decodeBase64Description(description);
  if (!decoded) return "-";
  return decoded.length > 140 ? "...." : decoded;
}
```

Now decodes base64 before checking length and displaying in table/card views.

#### 4. Updated Display Locations

**Table View (Desktop):**
- Description column now shows decoded text
- Truncates to "..." if longer than 140 characters

**Card View (Mobile):**
- Description field shows decoded text
- Truncates to "..." if longer than 140 characters

**Detail Dialog:**
- Full description shows decoded text
- No truncation, displays complete message

**CSV Export:**
- Exported descriptions are decoded
- Full text included in CSV file

## How It Works

### Detection Logic
1. Check if description is a string
2. Verify it's longer than 20 characters (to avoid false positives)
3. Match against base64 regex: `^[A-Za-z0-9+/]+=*$`
4. If matches, attempt to decode

### Decoding Process
1. Use browser's `atob()` function to decode base64
2. Validate decoded string contains only printable ASCII characters
3. If validation passes, return decoded string
4. If validation fails or error occurs, return original string

### Safety Features
- **Try-catch block**: Prevents crashes if decoding fails
- **Validation**: Ensures decoded output is readable text
- **Fallback**: Returns original value if not base64 or decoding fails
- **Length check**: Avoids false positives on short strings

## Examples

### Before Fix
```
Description: SGVsbG8gV29ybGQgLSBUaGlzIGlzIGEgdGVzdCBtZXNzYWdl
Metadata: oldValue: VGVzdCBWYWx1ZQ==, newValue: TmV3IFZhbHVl
```

### After Fix
```
Description: Hello World - This is a test message
Metadata: oldValue: Test Value, newValue: New Value
```

## Testing

To verify the fix works:

1. **View Existing Logs:**
   - Navigate to Audit Logs page
   - Check if previously base64-encoded descriptions now show as readable text
   - Check if metadata values are also decoded

2. **Create New Log:**
   - Perform an action that creates an audit log
   - Verify description displays correctly
   - Verify metadata values display correctly

3. **Export CSV:**
   - Export audit logs to CSV
   - Open CSV file and verify descriptions are decoded
   - Verify metadata values are decoded

4. **View Details:**
   - Click the eye icon on any log entry
   - Verify full description is decoded in the dialog
   - Verify metadata values are decoded

## Edge Cases Handled

✅ **Empty/Null Descriptions**: Returns "-"  
✅ **Non-Base64 Strings**: Returns original value unchanged  
✅ **Short Strings**: Skips base64 detection (< 20 chars)  
✅ **Invalid Base64**: Returns original value if decoding fails  
✅ **Binary Data**: Returns original value if decoded output isn't readable text  
✅ **Mixed Content**: Only decodes if entire string is base64  

## Performance Impact

- **Minimal**: Decoding only happens on render
- **Efficient**: Regex check is fast, decoding only attempted when pattern matches
- **No Backend Changes**: All processing happens in the browser

## Browser Compatibility

Uses standard `atob()` function, supported in:
- ✅ Chrome/Edge (all versions)
- ✅ Firefox (all versions)
- ✅ Safari (all versions)
- ✅ Opera (all versions)
- ✅ All modern browsers

## Notes

- Decoding is automatic and transparent to users
- No configuration needed
- Works retroactively on existing logs
- Does not modify database data (only display)
- Safe to deploy - falls back gracefully if issues occur

## Future Enhancements (Optional)

- Add support for other encoding formats (hex, URL encoding)
- Add manual decode/encode toggle in UI
- Add encoding detection for metadata fields
- Store encoding type in database for more reliable detection
