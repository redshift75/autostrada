# Classic Car Market Intelligence

A comprehensive platform for analyzing classic car market trends, tracking prices, and providing insights for collectors and investors.

## Database Setup with Supabase

### Prerequisites

- A Supabase account and project
- Node.js 18+ and npm/yarn

### Environment Configuration

1. Create a `.env.local` file in the root directory with the following variables:

```
# Supabase credentials
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database connection string (from Supabase)
DATABASE_URL=postgresql://postgres:your-db-password@db.your-project-id.supabase.co:5432/postgres

# API Keys
OPENAI_API_KEY=your_openai_api_key_here
```

You can find these credentials in your Supabase project dashboard under Project Settings > API.

### Database Initialization

1. Install dependencies:

```bash
npm install
```

2. Generate database migrations:

```bash
npm run db:generate
```

3. Initialize the database with schema:

```bash
npm run db:init
```

4. (Optional) Seed the database with sample data:

```bash
npm run db:seed
```

5. Check the database connection and tables:

```bash
npm run db:check
```

6. (Optional) Explore the database with Drizzle Studio:

```bash
npm run db:studio
```

You can also view and manage your database directly in the Supabase dashboard under Database > Tables.

## Using Supabase Transactions

This project uses Supabase transactions for database operations instead of direct database connections. This approach offers several advantages:

1. **Security**: Leverages Supabase's authentication and authorization system
2. **Simplicity**: Reduces the need for complex connection management
3. **Reliability**: Handles connection pooling and retries automatically
4. **Compatibility**: Works seamlessly with Supabase's other features

The implementation uses:
- Supabase client for authentication and basic operations
- Postgres.js for direct SQL queries when needed
- Drizzle ORM for type-safe database operations

## Development

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Features

- Comprehensive classic car market data analysis
- Price trend tracking and visualization
- Auction and listing data aggregation
- Rarity and value assessment
- Natural language querying for market insights

## Project Structure

- `/app` - Next.js application routes and pages
- `/components` - UI components
- `/lib` - Core functionality
  - `/db` - Database models and repositories
  - `/scrapers` - Data collection modules
  - `/standardization` - Data normalization utilities
  - `/langchain` - Agent infrastructure
- `/public` - Static assets
- `/scripts` - Utility scripts for database and development

## License

MIT
