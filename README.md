# Automotive Market Intelligence

A comprehensive platform for analyzing classic car market trends, tracking prices, and providing insights for collectors and investors.

## Deployment to Vercel

### Prerequisites

- A Vercel account
- A Supabase account
- A Clerk account for auth and user management
- Marketcheck API key for non-auction listings
- OpenAI API key
- Node.js 18+ and npm/yarn

**Configure Environment Variables**

Add the following environment variables in the Vercel project settings:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_SERVICE_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `MARKETCHECK_API_KEY`
- `OPENAI_API_KEY`
- `CLERK_SECRET_KEY`
- Any other variables from your `.env` file that are needed

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
- AI-powered market analysis and recommendations

## Project Structure

- `/app` - Next.js application routes and pages
- `/components` - UI components
- `/lib` - Core functionality
  - `/api` - API endpoints and handlers
  - `/langchain` - LLM agent infrastructure and tools
  - `/scrapers` - Data collection modules
  - `/standardization` - Data normalization utilities
  - `/supabase` - Database client and utilities
  - `/types` - TypeScript type definitions
  - `/utils` - Utility functions and visualization tools
- `/public` - Static assets
- `/scripts` - Utility scripts for data collection and analysis

## Scripts

### Data Collection

#### Scraping Auction Data

To run the scrapers with default settings:

```bash
npm run run-scrapers
```

To scrape completed auction results:

```bash
npm run run-scrapers:completed -- --make="BMW" --recency='7D' --maxPages=10
npm run run-scrapers:completed -- --makesFile='results/bat_makes.csv' --recency='7D'

| Argument | Description | Default |
|----------|-------------|---------|
| `--mode` | Mode to run the scraper in (completed, active, both) | both |
| `--make` | Make to search for | Porsche |
| `--model` | Model to search for | (empty) |
| `--maxPages` | Maximum number of pages to scrape | 3 |
| `--delay` | Delay between requests in milliseconds | 100 |
| `--pauseInterval` | Number of pages after which to pause for a longer time | 10 |
| `--pauseDelay` | Duration of the longer pause in milliseconds | 30000 |
| `--makesFile` | Path to a file containing a list of makes to process | (empty) |
```

To scrape only active auction listings:

```bash
npm run run-scrapers:active
```

The results will be saved to the `results` directory as JSON files.

### Normalizing Colors

To run color normalization use the following script

```bash
npx tsx scripts/normalize-colors.ts --batches=10 --upsert
```

### Database Operations

#### Uploading Data to Supabase

To upload all data to Supabase:

```bash
npm run upload-to-supabase
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
- `end_date`: Date when the auction ended
- `bid_amount`: Highest bid amount
- `bid_date`: Date of the highest bid
- `status`: Status of the auction (sold or unsold)
- `year`: Year of the vehicle
- `make`: Make of the vehicle
- `model`: Model of the vehicle
- `source_file`: Source file from which the data was loaded
- `created_at`: Timestamp when the record was created
- `updated_at`: Timestamp when the record was last updated

## AI Agent Capabilities

The project includes an AI agent powered by LangChain and OpenAI that can:

- Answer natural language questions about auction data
- Generate visualizations of price trends and distributions
- Provide market insights and recommendations
- Compare different vehicle models and their performance at auction

## License

This project is licensed under the MIT License - see the LICENSE file for details.

# Bring a Trailer Scraper

This project provides tools for scraping auction data from Bring a Trailer (BaT) and uploading it to Supabase for analysis.

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
## Example Queries

Here are some example queries you can ask the agent:

- "What's the average price of Porsche 911s from 2015 to 2020?"
- "What's the highest price ever paid for a Ferrari? Please sort by price from highest to lowest and limit to 20 results."
- "Show me the lowest mileage BMW M3s. Sort by mileage from lowest to highest and limit to 10 results."
- "What are the most common transmission types for Corvettes? Sort by newest first and limit to 15 results."
- "How many Mercedes-Benz vehicles were sold in the last year? Sort by date with newest first."

## Parameters

When querying the database, you can use the following parameters:

- `make`: The manufacturer of the vehicle
- `model`: The model of the vehicle
- `yearMin`: The minimum year to filter results
- `yearMax`: The maximum year to filter results
- `maxResults`: Maximum number of results to return (default: 100)
- `sortBy`: How to sort the results before limiting them (default: date_newest_first)

## Handling Large Result Sets

For queries that might return a large number of results, use the `maxResults` parameter to limit the number of results returned. This is especially important for broad queries like "all Ferrari models" or "all vehicles from the 1960s". A good default value is 50-100 results.

Example:
```
"What's the highest price ever paid for a Ferrari? Please sort by price from highest to lowest and limit to 20 results."
```

## Implementation Details

The database query functionality is implemented in the following files:

- `lib/langchain/tools.ts`: Contains the `createAuctionResultsTool` and `analyzeDatabaseQuery` functions
- `lib/langchain/config.ts`: Contains the agent prompt with instructions for database queries
- `scripts/test-database-query.ts`: Test script for the agent's database query functionality
- `scripts/test-db-direct.ts`: Test script for direct database queries

## Troubleshooting

If you encounter context length issues with large result sets, try:

1. Using the `maxResults` parameter to limit the number of results
2. Narrowing your query with more specific make, model, or year parameters
3. Using the direct database test script to verify the data exists in the database

1. Make sure you have the `tsx` package installed in your project
2. Try running the scripts with `npx tsx` directly:
   ```
   npx tsx -r dotenv/config ./scripts/test-db-direct.ts
   ```
3. Check that your environment variables are properly set in your `.env` file 
