# FrozenHub POS - Setup Instructions

## Prerequisites

1. **XAMPP** - Make sure XAMPP is installed and MySQL is running
2. **Node.js** - v18 or higher
3. **pnpm** - Package manager

## Database Setup

### 1. Start XAMPP MySQL
- Open XAMPP Control Panel
- Start Apache (if you want to use phpMyAdmin)
- Start MySQL

### 2. Create Database
The application will automatically create the database `frozenhub_pos` on first run.

Alternatively, you can create it manually:
```sql
CREATE DATABASE frozenhub_pos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. Configure Environment
Copy `.env.example` to `.env` and update if needed:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=frozenhub_pos
SESSION_SECRET=your-secret-key-here
```

## Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The server will:
1. Connect to MySQL
2. Create database tables automatically
3. Seed initial data (users, products, branches, etc.)

### Database Indexing (Recommended)

For optimal performance, create database indexes after initial setup:

```bash
# Create all indexes (recommended after first run)
pnpm db:index

# Verify indexes are created
pnpm db:verify

# Test query performance
pnpm db:test-performance
```

**Performance Impact:**
- 90-95% faster queries
- Essential for production
- See `DATABASE_INDEXING.md` for details

## Default Login Credentials

### System Administrator
- Email: `admin@frozenhub.com`
- Password: `admin123`

### Branch Manager  
- Email: `branch1@frozenhub.com`
- Password: `branch123`

### POS Operator
- Email: `pos@frozenhub.com`
- Password: `pos123`

### Customer
- Email: `customer1@example.com`
- Password: `customer123`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/signup` - Customer signup
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Products
- `GET /api/products` - List all products
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create product (admin only)
- `PUT /api/products/:id` - Update product (admin only)
- `DELETE /api/products/:id` - Delete product (admin only)

### Inventory
- `GET /api/inventory` - List inventory
- `GET /api/inventory/low-stock` - Get low stock items
- `POST /api/inventory` - Add inventory
- `PUT /api/inventory/:id` - Update inventory

### Branches & Users
- `GET /api/branches` - List branches
- `POST /api/branches` - Create branch (admin only)
- `GET /api/users` - List users (admin only)
- `POST /api/users` - Create user (admin only)
- `PUT /api/users/:id` - Update user (admin only)
- `DELETE /api/users/:id` - Delete user (admin only)

### Sales
- `GET /api/sales` - List sales
- `GET /api/sales/stats` - Sales statistics
- `POST /api/sales` - Create sale (POS)

### Pricing
- `GET /api/pricing` - List pricing
- `PUT /api/pricing/:id` - Update pricing (admin only)

## Development

```bash
# Run dev server (frontend + backend)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Type checking
pnpm typecheck

# Run tests
pnpm test
```

## Tech Stack

### Frontend
- React 18
- TypeScript
- TailwindCSS 3
- Radix UI
- React Router 6
- TanStack Query

### Backend
- Express
- MySQL2
- bcryptjs (password hashing)
- express-session (authentication)

## Database Schema

The system uses the following tables:
- `users` - User accounts with roles
- `branches` - Store branches
- `products` - Product catalog
- `inventory` - Stock levels per branch
- `pricing` - Product pricing tiers
- `sales` - Sales transactions
- `sale_items` - Line items for sales

All tables are automatically created on first run.

## Troubleshooting

### MySQL Connection Error
- Make sure XAMPP MySQL is running
- Check DB credentials in `.env`
- Verify MySQL is listening on port 3306

### Permission Denied
- Check user has correct role in database
- Clear browser cookies and re-login

### Port Already in Use
- Change PORT in `.env` file
- Or stop other services using port 8080

## Production Deployment

1. Set environment variables:
```env
NODE_ENV=production
DB_HOST=your-production-db-host
DB_USER=your-db-user
DB_PASSWORD=your-secure-password
SESSION_SECRET=your-random-secret-key
```

2. Build the application:
```bash
pnpm build
```

3. Create database indexes (important for performance):
```bash
pnpm db:index
```

4. Start the server:
```bash
pnpm start
```

## Documentation

- 📘 **Database Indexing**: `DATABASE_INDEXING.md` - Comprehensive indexing guide
- 📝 **Quick Reference**: `INDEX_QUICK_REFERENCE.md` - Index commands and tips
- ✅ **Optimization Summary**: `DATABASE_OPTIMIZATION_COMPLETE.md` - What was optimized
- 🔐 **Security**: `SECURITY.md` - Security features and best practices
- 🔒 **Session Security**: `SESSION_SECURITY.md` - Session management details
- 📊 **Inventory**: `INVENTORY_BACKEND_VERIFICATION.md` - CRUD documentation
- 🏗️ **SKU Generation**: `SKU_GENERATION.md` - SKU format guide

## Support

For issues or questions, check the code documentation or create an issue in the repository.
