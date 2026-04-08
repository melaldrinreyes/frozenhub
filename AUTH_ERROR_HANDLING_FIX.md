# Authentication Error Handling Fix

## Problem
When attempting to sign up, any error (rate limiting, validation, database issues) was being displayed as "Email already registered" regardless of the actual error.

## Root Cause
The error handling flow was incorrectly swallowing all errors:

1. **apiClient.signup()** - Throws error with actual message ✓
2. **authContext.signup()** - Caught error and returned `null` ✗
3. **LoginModal** - Assumed `null` = "email already registered" ✗

## Solution
Updated the error handling chain to properly propagate and display server error messages:

### Changes Made

#### 1. `client/lib/authContext.tsx` - Login Function
**Before:**
```typescript
catch (error) {
  console.error("Login error:", error);
  return null;  // ✗ Swallows error
}
```

**After:**
```typescript
catch (error) {
  console.error("Login error:", error);
  throw error;  // ✓ Re-throws error
}
```

#### 2. `client/lib/authContext.tsx` - Signup Function
**Before:**
```typescript
catch (error) {
  console.error("Signup error:", error);
  return null;  // ✗ Swallows error
}
```

**After:**
```typescript
catch (error) {
  console.error("Signup error:", error);
  throw error;  // ✓ Re-throws error
}
```

#### 3. `client/components/LoginModal.tsx` - Login Handler
**Before:**
```typescript
if (user) {
  // Success...
} else {
  setError("Invalid email or password");  // ✗ Generic message
}
```

**After:**
```typescript
if (user) {
  // Success...
}
// If no user, error is thrown and caught below
catch (err: any) {
  const errorMessage = err?.message || "An error occurred...";
  setError(errorMessage);  // ✓ Actual error message
}
```

#### 4. `client/components/LoginModal.tsx` - Signup Handler
**Before:**
```typescript
if (user) {
  // Success...
} else {
  setError("Email already registered...");  // ✗ Assumed reason
}
```

**After:**
```typescript
if (user) {
  // Success...
}
// If no user, error is thrown and caught below
catch (err: any) {
  const errorMessage = err?.message || "An error occurred...";
  setError(errorMessage);  // ✓ Actual error message
}
```

#### 5. `server/middleware/security.ts` - Rate Limiter Updates
**Before:**
```typescript
// Login: 5 attempts per 15 minutes (all environments)
// Signup: 3 attempts per hour (all environments)
```

**After:**
```typescript
// Login: 10 attempts per 15 minutes (dev), 5 (production)
// Signup: 20 attempts per hour (dev), 5 (production)
// Both skip rate limiting for localhost in development
```

## Error Messages Now Properly Displayed

### Signup Errors:
- ✅ "All fields are required"
- ✅ "Invalid email format"
- ✅ "Password must contain at least 8 characters"
- ✅ "Password must contain at least one uppercase letter"
- ✅ "Password must contain at least one lowercase letter"
- ✅ "Password must contain at least one number"
- ✅ "Password must contain at least one special character"
- ✅ "Invalid phone number"
- ✅ "Email already registered" (only when actually registered)
- ✅ "Too many signup attempts from this IP, please try again after 1 hour"

### Login Errors:
- ✅ "Invalid email or password"
- ✅ "Too many login attempts from this IP, please try again after 15 minutes"
- ✅ "All fields are required"

## Testing Instructions

### Test 1: Invalid Email Format
1. Open signup form
2. Enter: name="Test", email="invalid-email", phone="1234567890", password="Test123!"
3. **Expected**: "Invalid email format"

### Test 2: Weak Password
1. Open signup form
2. Enter: name="Test", email="test@test.com", phone="1234567890", password="weak"
3. **Expected**: "Password must contain at least 8 characters" (or other password validation message)

### Test 3: Short Phone Number
1. Open signup form
2. Enter: name="Test", email="test@test.com", phone="123", password="Test123!"
3. **Expected**: "Invalid phone number"

### Test 4: Duplicate Email (Actual Case)
1. Create an account successfully
2. Try to create another account with the same email
3. **Expected**: "Email already registered"

### Test 5: Rate Limiting
1. In production mode, attempt signup 6 times within an hour
2. **Expected**: "Too many signup attempts from this IP, please try again after 1 hour"
3. In development on localhost, rate limiting should be skipped

### Test 6: Missing Fields
1. Open signup form
2. Leave name field empty
3. **Expected**: Client-side validation or "All fields are required"

## Benefits

1. **Better UX**: Users see the actual reason for failure
2. **Easier Debugging**: Developers can see real error messages in console
3. **Security**: Still prevents brute force with rate limiting
4. **Development**: More lenient limits in dev mode for testing

## Additional Notes

- All errors are logged to console with `console.error()` for debugging
- Rate limiters skip localhost (::1) in development mode
- Production limits remain strict for security
- Error messages are clear and actionable for users
