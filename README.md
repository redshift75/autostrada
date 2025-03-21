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

To test the scrapers with default settings (Porsche 911, 3 pages):

```bash
npm run test-scrapers
```

To scrape only completed auction results:

```bash
npm run test-scrapers:completed -- --make="BMW" --recency='7D' --maxPages=10
npm run test-scrapers:completed -- --makesFile='results/bat_makes.csv' --recency='7D'

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
npm run test-scrapers:active
```

The results will be saved to the `results` directory as JSON files.

### Data Analysis

#### Testing Auction Analysis Tools

To test the basic auction analysis tool:

```bash
npm run test-auction-tools
```

To test the AI agent with auction data:

```bash
npm run test-auction-tools:agent
```

To test the AI agent with auction data and visualizations:

```bash
npm run test-auction-tools:agent-viz
```

You can customize the analysis by adding parameters:

```bash
npm run test-auction-tools -- --make=Ferrari --model=Testarossa --yearMin=1990 --yearMax=2000 --maxPages=3 --query="What's the price trend for Ferrari Testarossa models from the 1990s?"
```

### Database Operations

#### Uploading Data to Supabase

To upload all data to Supabase:

```bash
npm run upload-to-supabase
```

To upload only completed auction results:

```bash
npm run upload-completed
```

To upload only active auction listings:

```bash
npm run upload-active
```

To test the Supabase connection:

```bash
npm run test-supabase
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
- `generateVisualizations`: Whether to generate visualizations of the results (default: false)
- `sortBy`: How to sort the results before limiting them (default: date_newest_first)
  - `price_high_to_low`: Sort by price from highest to lowest
  - `price_low_to_high`: Sort by price from lowest to highest
  - `date_newest_first`: Sort by date with newest first
  - `date_oldest_first`: Sort by date with oldest first
  - `mileage_lowest_first`: Sort by mileage from lowest to highest
  - `mileage_highest_first`: Sort by mileage from highest to lowest

## Handling Large Result Sets

For queries that might return a large number of results, use the `maxResults` parameter to limit the number of results returned. This is especially important for broad queries like "all Ferrari models" or "all vehicles from the 1960s". A good default value is 50-100 results.

Example:
```
"What's the highest price ever paid for a Ferrari? Please sort by price from highest to lowest and limit to 20 results."
```

## Sorting Results

When asking for specific information like highest prices, lowest mileage, or most recent sales, you should specify how to sort the results. The agent will automatically choose an appropriate sorting method based on your query, but you can also explicitly specify it.

Examples:
- For highest prices: "Sort by price from highest to lowest"
- For lowest mileage: "Sort by mileage from lowest to highest"
- For newest listings: "Sort by date with newest first"

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
