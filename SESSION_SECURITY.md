# Session Security Implementation

## Overview

This document describes the comprehensive session-based security measures implemented to prevent session hijacking, session fixation, and other session-related attacks.

## Security Features

### 1. Session Fingerprinting 🔐

**Purpose:** Detect and prevent session hijacking attempts

**How it works:**
- Generates a unique fingerprint from the user's browser characteristics
- Fingerprint includes: User-Agent, Accept-Language, Accept-Encoding
- Stored on first authentication and validated on every request
- If fingerprint changes, the session is immediately destroyed

**Protection against:**
- Session hijacking (stolen session tokens)
- Cross-device session theft
- Man-in-the-middle attacks

**Implementation:**
```typescript
// Middleware: sessionFingerprinting
// File: server/middleware/sessionSecurity.ts
```

**Response when detected:**
```json
{
  "error": "Session invalid. Please log in again.",
  "code": "SESSION_HIJACK_DETECTED"
}
```

---

### 2. Session Regeneration 🔄

**Purpose:** Prevent session fixation attacks

**How it works:**
- Generates a new session ID after successful login/signup
- Old session ID is invalidated
- Prevents attackers from fixing a session ID before authentication

**Protection against:**
- Session fixation attacks
- Pre-session attacks

**Implementation:**
```typescript
// Called in handleLogin and handleSignup
await regenerateSession(req);
```

**When triggered:**
- After successful login
- After successful signup
- After privilege escalation

---

### 3. Activity Tracking 📊

**Purpose:** Monitor and audit session activity

**How it works:**
- Tracks last activity timestamp on every request
- Stores login metadata (IP, User-Agent, login time)
- Creates an audit trail for security investigations

**Data tracked:**
```typescript
{
  lastActivity: "2025-11-08T12:34:56.789Z",
  loginMetadata: {
    ip: "192.168.1.100",
    userAgent: "Mozilla/5.0...",
    loginTime: "2025-11-08T10:00:00.000Z"
  }
}
```

**Implementation:**
```typescript
// Middleware: trackSessionActivity
// File: server/middleware/sessionSecurity.ts
```

---

### 4. Session Timeout ⏰

**Purpose:** Enforce absolute session expiration

**How it works:**
- Maximum session lifetime: 7 days (absolute)
- Rolling expiration: resets on activity (configured in session middleware)
- Absolute timeout: enforced regardless of activity

**Protection against:**
- Long-term session hijacking
- Dormant compromised sessions

**Implementation:**
```typescript
// Middleware: checkSessionTimeout
// File: server/middleware/sessionSecurity.ts
```

**Response when expired:**
```json
{
  "error": "Session expired. Please log in again.",
  "code": "SESSION_TIMEOUT"
}
```

---

### 5. Concurrent Session Limiting 👥

**Purpose:** Prevent account sharing and credential stuffing

**How it works:**
- Limits each user to 3 concurrent active sessions
- Tracks sessions per user ID
- Rejects new sessions when limit is reached

**Configuration:**
```typescript
const MAX_SESSIONS_PER_USER = 3;
```

**Protection against:**
- Account sharing
- Credential stuffing attacks
- Unauthorized access from multiple locations

**Implementation:**
```typescript
// Middleware: limitConcurrentSessions
// File: server/middleware/sessionSecurity.ts
```

**Response when limit exceeded:**
```json
{
  "error": "Maximum number of concurrent sessions reached. Please log out from other devices.",
  "code": "TOO_MANY_SESSIONS"
}
```

---

### 6. Session Cleanup 🧹

**Purpose:** Properly clean up session tracking data

**How it works:**
- Removes fingerprints on session destruction
- Cleans up concurrent session tracking
- Prevents memory leaks

**Implementation:**
```typescript
// Called in handleLogout
cleanupSessionTracking(sessionId, userId);
```

---

## Session Configuration

### Current Settings

```typescript
session({
  secret: process.env.SESSION_SECRET || "frozenhub-secret-key-change-in-production",
  resave: false,
  saveUninitialized: false,
  name: "sessionId", // Custom name (hides default "connect.sid")
  cookie: {
    httpOnly: true, // Prevents JavaScript access
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    path: "/",
  },
  rolling: true, // Reset expiration on activity
})
```

### Cookie Security

| Feature | Value | Purpose |
|---------|-------|---------|
| `httpOnly` | `true` | Prevents XSS attacks from stealing cookies |
| `secure` | `true` (prod) | Ensures cookies only sent over HTTPS |
| `sameSite` | `strict` (prod) | Prevents CSRF attacks |
| `maxAge` | 7 days | Session lifetime |
| `rolling` | `true` | Extends session on activity |

---

## Middleware Chain

The security middleware is applied in this order:

```typescript
// 1. Session middleware (express-session)
app.use(session({ ... }))

// 2. Load user from session
app.use(loadUser)

// 3. Track activity
app.use(trackSessionActivity)

// 4. Check timeout
app.use(checkSessionTimeout)

// 5. Validate fingerprint
app.use(sessionFingerprinting)

// 6. Check concurrent sessions
app.use(limitConcurrentSessions)
```

---

## Security Events Logged

### Login Success
```
✅ Login successful: {
  userId: "user-123",
  email: "user@example.com",
  role: "admin",
  sessionId: "abc123..."
}
```

### Session Hijacking Detected
```
⚠️  Session hijacking attempt detected: {
  sessionId: "abc123...",
  userId: "user-123",
  ip: "192.168.1.100",
  userAgent: "Mozilla/5.0..."
}
```

### Session Timeout
```
Session expired (absolute timeout): {
  userId: "user-123",
  loginTime: "2025-11-01T10:00:00.000Z"
}
```

### Concurrent Session Limit
```
⚠️  Concurrent session limit exceeded: {
  userId: "user-123",
  currentSessions: 3,
  ip: "192.168.1.100"
}
```

### Logout Success
```
✅ Logout successful: {
  userId: "user-123",
  sessionId: "abc123..."
}
```

---

## Attack Scenarios Prevented

### 1. Session Hijacking
**Attack:** Attacker steals session token and uses it from different browser
**Prevention:** Fingerprint mismatch detected → Session destroyed
**User Impact:** User must log in again

### 2. Session Fixation
**Attack:** Attacker sets known session ID before user logs in
**Prevention:** Session ID regenerated after login → Old ID invalid
**User Impact:** None (transparent to user)

### 3. Session Timeout Exploitation
**Attack:** Attacker uses old stolen session after extended period
**Prevention:** Absolute timeout enforced → Session expired
**User Impact:** User must log in again after 7 days

### 4. Concurrent Access
**Attack:** Multiple users share one account
**Prevention:** Session limit enforced → 4th session rejected
**User Impact:** Must log out from other devices

### 5. CSRF Attacks
**Attack:** Attacker tricks user into making unwanted requests
**Prevention:** SameSite=strict cookie attribute
**User Impact:** None

### 6. XSS Cookie Theft
**Attack:** Attacker injects script to steal session cookie
**Prevention:** HttpOnly cookie attribute prevents JS access
**User Impact:** None

---

## Production Recommendations

### 1. Environment Variables
```bash
SESSION_SECRET=<long-random-string-at-least-32-chars>
NODE_ENV=production
```

**Generate strong secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Use Redis for Session Storage
For production environments with multiple servers:
```typescript
import RedisStore from "connect-redis";
import { createClient } from "redis";

const redisClient = createClient();
await redisClient.connect();

app.use(session({
  store: new RedisStore({ client: redisClient }),
  // ... other options
}));
```

### 3. Monitor Session Events
Set up logging/monitoring for:
- Session hijacking attempts
- Concurrent session limit hits
- Unusual login patterns

### 4. Adjust Limits Based on Usage
```typescript
// Modify these constants based on your needs:
const MAX_SESSIONS_PER_USER = 3; // sessionSecurity.ts
const maxSessionAge = 1000 * 60 * 60 * 24 * 7; // 7 days
```

### 5. Enable HTTPS
Session security depends on HTTPS in production:
- Set `secure: true` in cookie options
- Use SSL/TLS certificates
- Redirect HTTP to HTTPS

---

## Testing

### Test Session Hijacking Detection
1. Log in from Chrome (Browser A)
2. Copy session cookie
3. Open Firefox (Browser B)
4. Paste session cookie
5. Make API request → Should fail with `SESSION_HIJACK_DETECTED`

### Test Session Regeneration
1. Set session cookie before login
2. Log in successfully
3. Verify session ID changed (old cookie invalid)

### Test Concurrent Sessions
1. Log in from 3 different browsers
2. Try to log in from 4th browser
3. Should fail with `TOO_MANY_SESSIONS`

### Test Session Timeout
1. Log in
2. Wait 7 days (or modify timeout for testing)
3. Make API request → Should fail with `SESSION_TIMEOUT`

---

## API Error Codes

| Code | HTTP Status | Description | Action Required |
|------|-------------|-------------|-----------------|
| `SESSION_HIJACK_DETECTED` | 401 | Fingerprint mismatch | Log in again |
| `SESSION_TIMEOUT` | 401 | Absolute timeout reached | Log in again |
| `TOO_MANY_SESSIONS` | 401 | Concurrent session limit | Log out from other devices |

---

## Maintenance

### Clear Session Tracking
If you need to reset all session tracking (development only):
```typescript
// Restart the server - in-memory maps will be cleared
// For production with Redis, flush Redis keys
```

### Monitor Memory Usage
Session fingerprints and concurrent session tracking are stored in memory. For high-traffic applications, consider:
- Using Redis for storage
- Implementing cleanup for expired sessions
- Setting up session storage limits

---

## Summary

✅ **Session Fingerprinting** - Detects hijacking attempts  
✅ **Session Regeneration** - Prevents fixation attacks  
✅ **Activity Tracking** - Creates audit trail  
✅ **Session Timeout** - Enforces absolute expiration  
✅ **Concurrent Limiting** - Prevents account sharing  
✅ **Session Cleanup** - Proper memory management  
✅ **Secure Cookies** - HttpOnly, Secure, SameSite  
✅ **Custom Session Name** - Hides default identifier  

**Result:** Enterprise-grade session security preventing common attacks! 🔒
