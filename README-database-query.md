# Database Query Functionality

This document explains how to use the agent's database query functionality to look up results in the Supabase database.

## Overview

The agent has been enhanced to query the Supabase database using the existing `createAuctionResultsTool`. This allows the agent to answer questions about auction results, price trends, vehicle specifications, and market statistics.

## How It Works

1. The agent uses the `fetch_auction_results` tool to query the database for auction data.
2. The tool returns data with the following fields:
   - listing_id
   - url
   - title
   - image_url
   - sold_price
   - sold_date
   - bid_amount
   - bid_date
   - status
   - year
   - make
   - model
   - mileage
   - bidders
   - watchers
   - comments
   - transmission

3. The agent then analyzes this data to answer specific questions.

## Example Queries

Here are some example queries you can ask the agent:

- "What's the average price of Porsche 911s from 2015 to 2020?"
- "What's the highest price ever paid for a Ferrari?"
- "Show me the lowest mileage BMW M3s"
- "What are the most common transmission types for Corvettes?"
- "How many Mercedes-Benz vehicles were sold in the last year?"

## Parameters

When querying the database, you can use the following parameters:

- `make`: The manufacturer of the vehicle
- `model`: The model of the vehicle
- `yearMin`: The minimum year to filter results
- `yearMax`: The maximum year to filter results
- `maxResults`: Maximum number of results to return (default: 100)
- `generateVisualizations`: Whether to generate visualizations of the results (default: false)

## Handling Large Result Sets

For queries that might return a large number of results, use the `maxResults` parameter to limit the number of results returned. This is especially important for broad queries like "all Ferrari models" or "all vehicles from the 1960s". A good default value is 50-100 results.

Example:
```
"What's the highest price ever paid for a Ferrari? Please limit the results to 50."
```

## Testing

You can test the database query functionality using the following scripts:

1. **Agent Test**: Tests the agent's ability to query the database
   ```
   npm run test-db-query
   ```

2. **Direct Database Test**: Tests direct database queries without going through the agent
   ```
   npm run test-db-direct
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