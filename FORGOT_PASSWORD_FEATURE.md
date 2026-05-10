# Forgot Password Feature

## Overview
The forgot password feature allows users to reset their password if they've forgotten it. The system generates a secure token that users can use to reset their password.

## User Flow

### 1. Request Password Reset
1. User clicks "Forgot password?" link on the login form
2. User enters their email address
3. System generates a 6-character token and stores it in the database
4. Token expires after 1 hour
5. In development mode, the token is displayed in the console and returned in the API response
6. In production, the token would be sent via email (email integration not yet implemented)

### 2. Reset Password
1. User clicks "Have a reset token?" link on the login form
2. User enters the token they received
3. User enters their new password (minimum 6 characters)
4. User confirms the new password
5. System validates the token and updates the password
6. Token is marked as used and cannot be reused
7. User is redirected to sign in with their new password

## Technical Implementation

### Frontend Components
- **LoginModal.tsx**: Updated with three new tabs:
  - `forgot-password`: Request password reset
  - `reset-password`: Reset password with token
  - Navigation between tabs

### Backend Endpoints

#### POST /api/auth/forgot-password
- **Body**: `{ email: string }`
- **Response**: Success message (always returns success to prevent email enumeration)
- **Development**: Returns token in response
- **Actions**:
  - Validates email exists
  - Generates 6-character token
  - Stores token with 1-hour expiration
  - Logs activity

#### POST /api/auth/reset-password
- **Body**: `{ token: string, newPassword: string }`
- **Response**: Success or error message
- **Actions**:
  - Validates token exists and hasn't expired
  - Validates token hasn't been used
  - Hashes new password
  - Updates user password
  - Marks token as used
  - Logs activity

### Database Schema

#### password_reset_tokens table
```sql
CREATE TABLE password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  token VARCHAR(10) NOT NULL,
  expires_at DATETIME NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_id (user_id),
  INDEX idx_token (token),
  INDEX idx_expires_at (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

## Security Features

1. **Token Expiration**: Tokens expire after 1 hour
2. **Single Use**: Tokens can only be used once
3. **Email Enumeration Prevention**: Always returns success message regardless of whether email exists
4. **Rate Limiting**: Uses signup rate limiter to prevent abuse
5. **Password Requirements**: Minimum 6 characters
6. **Activity Logging**: All password reset actions are logged
7. **Secure Hashing**: Passwords are hashed with bcrypt (12 rounds)

## Development vs Production

### Development Mode
- Token is logged to console: `Password reset token for email@example.com: ABC123`
- Token is included in API response for testing
- No email sending required

### Production Mode (Future Enhancement)
- Token should be sent via email service (SendGrid, AWS SES, etc.)
- Token should NOT be included in API response
- Email should include:
  - Reset token
  - Expiration time
  - Link to reset password page
  - Security warning about not sharing the token

## Future Enhancements

1. **Email Integration**: 
   - Integrate with email service provider
   - Create email templates for password reset
   - Include direct link to reset page with token pre-filled

2. **Token Link**: 
   - Create a dedicated reset password page with token in URL
   - Example: `/reset-password?token=ABC123`
   - Auto-fill token from URL parameter

3. **Enhanced Security**:
   - Longer tokens (8-10 characters)
   - More complex token generation (alphanumeric + special chars)
   - IP address validation
   - Device fingerprinting

4. **User Experience**:
   - Show token expiration countdown
   - Allow token resend
   - Show password strength indicator
   - Add "Remember me" option after reset

## Testing

### Test the Feature
1. Start the development server: `pnpm dev`
2. Open the login modal
3. Click "Forgot password?"
4. Enter a valid user email
5. Check the console for the token
6. Click "Have a reset token?"
7. Enter the token and new password
8. Sign in with the new password

### Test Cases
- ✅ Valid email generates token
- ✅ Invalid email returns success (no enumeration)
- ✅ Token expires after 1 hour
- ✅ Used token cannot be reused
- ✅ Invalid token shows error
- ✅ Password must be at least 6 characters
- ✅ Passwords must match
- ✅ Activity is logged for all actions
