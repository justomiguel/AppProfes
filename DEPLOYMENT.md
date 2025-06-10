# Deployment Guide: Vercel + Supabase

## Prerequisites

1. **Supabase Account**: Create a free account at [supabase.com](https://supabase.com)
2. **Vercel Account**: Create a free account at [vercel.com](https://vercel.com)

## Step 1: Set up Supabase Database

1. Create a new project in Supabase
2. Go to **Settings** → **Database**
3. Copy the **Connection string** (it looks like: `postgresql://postgres:[YOUR-PASSWORD]@[HOST]:5432/postgres`)
4. Make sure to replace `[YOUR-PASSWORD]` with your actual database password
5. You'll also find the pooled connection string which is recommended for production

## Step 2: Generate Security Keys

Run these commands in your terminal to generate the required security keys:

```bash
# Generate JWT Secret (64 characters)
openssl rand -hex 32

# Generate Encryption Key (64 characters)  
openssl rand -hex 32
```

Save these keys - you'll need them for both local development and Vercel deployment.

## Step 3: Configure Local Development

Create or update your `.env.local` file with your Supabase credentials:

```bash
# Environment Configuration
NODE_ENV=development
NODE_TLS_REJECT_UNAUTHORIZED=0  # Required for Supabase SSL certificates

# Database Configuration - Supabase PostgreSQL
DATABASE_URL="postgres://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x"

# Security Keys
JWT_SECRET="your_64_character_hex_string"
ENCRYPTION_KEY="your_64_character_hex_string"
```

## Step 4: Configure Vercel Environment Variables

In your Vercel project dashboard, go to **Settings** → **Environment Variables** and add:

### Required Variables:
- `NODE_ENV` = `production`
- `DATABASE_URL` = `your_supabase_connection_string`
- `JWT_SECRET` = `your_64_character_hex_string`
- `ENCRYPTION_KEY` = `your_64_character_hex_string`

### Optional Variables:
- `OPENAI_API_KEY` = `sk-your-openai-api-key` (for default API key)

## Step 5: Deploy to Vercel

1. Connect your GitHub repository to Vercel
2. Vercel will automatically detect it's a Next.js project
3. Deploy with the default settings

## Step 6: Database Initialization

The database tables will be created automatically on first deployment. The system will:

1. Create `users` table
2. Create `global_settings` table  
3. Create `evaluation_history` table
4. Set up proper indexes and triggers

## Step 7: Create Admin User

1. Register a new user through the app
2. If you use the email `justomiguelvargas@gmail.com`, it will automatically get admin privileges
3. Or manually update the database to grant admin privileges to any user

## Key Changes from Previous Version

- ✅ **Unified Database**: Now uses PostgreSQL (Supabase) for both development and production
- ✅ **No SQLite**: Removed SQLite dependency completely
- ✅ **Simplified Configuration**: Same database configuration for all environments
- ✅ **Better Connection Handling**: Improved connection pooling and error handling
- ✅ **SSL Certificate Handling**: Proper SSL configuration for Supabase connections

## Troubleshooting

### Common Issues:

1. **SSL Certificate Errors**: If you get "self-signed certificate in certificate chain" errors, make sure to set `NODE_TLS_REJECT_UNAUTHORIZED=0` in your environment variables for development.

2. **Connection Refused**: Check that your Supabase connection string is correct and includes the password.

3. **JWT Errors**: Ensure `JWT_SECRET` is exactly 64 characters (32 bytes in hex).

4. **Encryption Errors**: Ensure `ENCRYPTION_KEY` is exactly 64 characters (32 bytes in hex).

5. **Database Connection Test**: You can test your database connection by checking the Vercel function logs after deployment.

### Database Connection Test

You can test your database connection locally by running:

```bash
npm run dev
```

Check the console for database connection messages.

### SSL Certificate Issues

If you encounter SSL certificate issues with Supabase, you can test the connection with:

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 node test-db.js
```

## Features Available After Deployment

- ✅ User registration and authentication
- ✅ OpenAI API integration for evaluations
- ✅ Local LLM support (runs in browser)
- ✅ Admin panel for user management
- ✅ Global settings configuration
- ✅ Evaluation history tracking
- ✅ Multi-language support (Spanish/English)
- ✅ Consistent database across all environments

## Security Notes

- All API keys are encrypted before storage
- JWT tokens are used for authentication
- Database connections use SSL in production (with proper certificate handling)
- Environment variables are securely managed by Vercel
- Connection pooling prevents connection exhaustion
- SSL certificate verification is properly configured for Supabase

## Support

If you encounter issues:
1. Check Vercel function logs
2. Verify all environment variables are set
3. Test database connection in Supabase dashboard
4. Ensure all required packages are installed
5. Check that your Supabase project is active and not paused
6. For SSL issues, verify the `NODE_TLS_REJECT_UNAUTHORIZED` setting 