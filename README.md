# Classic Car Market Intelligence

A comprehensive platform for analyzing classic car market trends, tracking prices, and providing insights for collectors and investors.

## Deployment to Vercel

### Prerequisites

- A Vercel account (you can sign up at [vercel.com](https://vercel.com))
- Git repository with your project (GitHub, GitLab, or Bitbucket)

### Deployment Steps

1. **Push your code to a Git repository**

   If you haven't already, push your code to a Git repository:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin your-repository-url
   git push -u origin main
   ```

2. **Connect to Vercel**

   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New" > "Project"
   - Import your Git repository
   - Configure your project:
     - Framework Preset: Next.js
     - Root Directory: ./
     - Build Command: npm run build
     - Output Directory: .next

3. **Configure Environment Variables**

   Add the following environment variables in the Vercel project settings:

   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`
   - `OPENAI_API_KEY`
   - Any other variables from your `.env` file that are needed

4. **Deploy**

   Click "Deploy" and wait for the build to complete.

5. **Update NEXT_PUBLIC_APP_URL**

   After deployment, update the `NEXT_PUBLIC_APP_URL` environment variable to match your Vercel deployment URL.

### Continuous Deployment

Vercel automatically deploys when you push changes to your repository. You can configure deployment settings in the Vercel dashboard.

## Database Setup with Supabase

### Prerequisites

- A Supabase account and project
- Node.js 18+ and npm/yarn

### Environment Configuration

1. Create a `.env.local` file in the root directory with the following variables:

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

# Bring a Trailer Scraper

This project provides tools for scraping auction data from Bring a Trailer (BaT) and uploading it to Supabase for analysis.

## Features

- Scrape completed auction results with pagination support
- Scrape active auction listings
- Upload data to Supabase for storage and analysis
- Filter results by make, model, and year

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Copy the `.env.example` file to `.env` and update with your Supabase credentials:
   ```
   cp .env.example .env
   ```

## Usage

### Scraping Completed Auction Results

To scrape completed auction results:

```
npm run test-results-scraper
```

This will scrape completed auction results for:
- Porsche 911 (3 pages)
- Ferrari (2 pages)
- Mercedes-Benz 300SL (2 pages)

The results will be saved to the `results` directory as JSON files.

### Scraping Active Auction Listings

To scrape active auction listings:

```
npm run test-active-scraper
```

This will scrape all active auction listings and filter for:
- All active listings

The results will be saved to the `results` directory as JSON files.

### Uploading Data to Supabase

To upload all data to Supabase:

```
npm run upload-to-supabase
```

To upload only completed auction results:

```
npm run upload-completed
```

To upload only active auction listings:

```
npm run upload-active
```

## Database Schema

### Completed Auctions Table

The `bat_completed_auctions` table stores data about completed auctions:

- `id`: Auto-incrementing primary key
- `listing_id`: Unique identifier for the listing
- `url`: URL of the auction listing
- `title`: Title of the auction listing
- `image_url`: URL of the main image
- `sold_price`: Final sale price (if sold)
- `sold_date`: Date when the auction ended
- `bid_amount`: Highest bid amount
- `bid_date`: Date of the highest bid
- `status`: Status of the auction (sold or unsold)
- `year`: Year of the vehicle
- `make`: Make of the vehicle
- `model`: Model of the vehicle
- `source_file`: Source file from which the data was loaded
- `created_at`: Timestamp when the record was created
- `updated_at`: Timestamp when the record was last updated

### Active Auctions Table

The `bat_active_auctions` table stores data about active auctions:

- `id`: Auto-incrementing primary key
- `listing_id`: Unique identifier for the listing
- `url`: URL of the auction listing
- `title`: Title of the auction listing
- `image_url`: URL of the main image
- `current_bid`: Current bid amount
- `current_bid_formatted`: Formatted current bid (e.g., "USD $10,000")
- `end_date`: Date when the auction ends
- `status`: Status of the auction (active or ended)
- `year`: Year of the vehicle
- `make`: Make of the vehicle
- `model`: Model of the vehicle
- `location`: Location of the vehicle
- `no_reserve`: Whether the auction has no reserve
- `premium`: Whether the auction is a premium listing
- `source_file`: Source file from which the data was loaded
- `created_at`: Timestamp when the record was created
- `updated_at`: Timestamp when the record was last updated

## License

This project is licensed under the MIT License - see the LICENSE file for details.
