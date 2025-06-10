# Deployment Guide: Vercel + Supabase

## Prerequisites

1. **Supabase Account**: Create a free account at [supabase.com](https://supabase.com)
2. **Vercel Account**: Create a free account at [vercel.com](https://vercel.com)

## Step 1: Set up Supabase Database

1. Create a new project in Supabase
2. Go to **Settings** → **Database**
3. Copy the **Connection string** (it looks like: `postgresql://postgres:[YOUR-PASSWORD]@[HOST]:5432/postgres`)
4. Make sure to replace `[YOUR-PASSWORD]` with your actual database password

## Step 2: Generate Security Keys

Run these commands in your terminal to generate the required security keys:

```bash
# Generate JWT Secret (64 characters)
openssl rand -hex 32

# Generate Encryption Key (64 characters)  
openssl rand -hex 32
```

Save these keys - you'll need them for Vercel environment variables.

## Step 3: Configure Vercel Environment Variables

In your Vercel project dashboard, go to **Settings** → **Environment Variables** and add:

### Required Variables:
- `NODE_ENV` = `production`
- `DATABASE_URL` = `your_supabase_connection_string`
- `JWT_SECRET` = `your_64_character_hex_string`
- `ENCRYPTION_KEY` = `your_64_character_hex_string`

### Optional Variables:
- `OPENAI_API_KEY` = `sk-your-openai-api-key` (for default API key)

## Step 4: Deploy to Vercel

1. Connect your GitHub repository to Vercel
2. Vercel will automatically detect it's a Next.js project
3. Deploy with the default settings

## Step 5: Database Initialization

The database tables will be created automatically on first deployment. The system will:

1. Create `users` table
2. Create `global_settings` table  
3. Create `evaluation_history` table
4. Set up proper indexes and triggers

## Step 6: Create Admin User

1. Register a new user through the app
2. If you use the email `justomiguelvargas@gmail.com`, it will automatically get admin privileges
3. Or manually update the database to grant admin privileges to any user

## Troubleshooting

### Common Issues:

1. **SQLITE_READONLY Error**: This means SQLite is being used instead of PostgreSQL. Make sure `DATABASE_URL` is set correctly in Vercel.

2. **Connection Refused**: Check that your Supabase connection string is correct and includes the password.

3. **JWT Errors**: Ensure `JWT_SECRET` is exactly 64 characters (32 bytes in hex).

4. **Encryption Errors**: Ensure `ENCRYPTION_KEY` is exactly 64 characters (32 bytes in hex).

### Database Connection Test

You can test your database connection by checking the Vercel function logs after deployment.

## Features Available After Deployment

- ✅ User registration and authentication
- ✅ OpenAI API integration for evaluations
- ✅ Local LLM support (runs in browser)
- ✅ Admin panel for user management
- ✅ Global settings configuration
- ✅ Evaluation history tracking
- ✅ Multi-language support (Spanish/English)

## Security Notes

- All API keys are encrypted before storage
- JWT tokens are used for authentication
- Database connections use SSL in production
- Environment variables are securely managed by Vercel

## Support

If you encounter issues:
1. Check Vercel function logs
2. Verify all environment variables are set
3. Test database connection in Supabase dashboard
4. Ensure all required packages are installed 