# User Management Scripts

Scripts to manage user roles and permissions in the FrozenHub POS system.

## Available Scripts

### 1. List All Users

View all users in the database with their roles and details.

```bash
pnpm list-users
```

**Output:**
- Shows users grouped by role (Admin, Branch Admin, POS Operator, Customer)
- Displays email, name, phone, creation date, and branch ID
- Shows total user count

### 2. Promote User to Admin

Promote an existing user to admin role, granting full system access.

```bash
pnpm promote-admin <email>
```

**Example:**
```bash
pnpm promote-admin user@example.com
```

**What Admin Users Can Do:**
- Access all admin panels (`/admin/*`)
- Manage CMS content (Homepage, About Us, Company Branding, Featured Products)
- Manage all branches and users
- View all analytics and reports
- Configure system settings
- Manage products, categories, and pricing
- View stock transfer logs across all branches

**Before Promoting:**
1. List all users first: `pnpm list-users`
2. Find the email of the user you want to promote
3. Run the promote command with their email

**Security Note:** Only promote trusted users to admin role as they will have full system access.

## Default Admin Account

The system comes with a default admin account:

```
Email: admin@gmail.com
Password: admin123
```

⚠️ **Important:** Change this password immediately after first login for security!

## User Roles

### 1. Admin (👑)
- Full system access
- Can manage everything
- Can access all admin routes
- Can modify CMS content

### 2. Branch Admin (🏢)
- Manage their assigned branch
- View branch-specific reports
- Manage branch inventory
- Handle stock transfers
- Manage POS operators for their branch

### 3. POS Operator (💼)
- Process sales at POS
- View products and inventory
- Handle customer transactions
- Limited to their assigned branch

### 4. Customer (👤)
- Browse products
- Place orders (when logged in)
- View order history
- Limited public access

## Troubleshooting

### Error: "User not found"
- Check the email address is correct
- Run `pnpm list-users` to see all available users
- Make sure the user exists in the database

### Error: "User is already an admin"
- The user already has admin privileges
- No action needed

### Database Connection Errors
- Check your `.env` file has correct database credentials
- Ensure MySQL server is running
- Verify database name matches your configuration

## Example Workflow

```bash
# 1. See who's in the system
pnpm list-users

# 2. Promote a user to admin
pnpm promote-admin newadmin@company.com

# 3. Verify the change
pnpm list-users
```

## Related Files

- `server/scripts/promote-to-admin.ts` - Promotion script
- `server/scripts/list-users.ts` - User listing script
- `server/middleware/auth.ts` - Authentication & authorization
- `server/db.ts` - Database initialization with default admin
