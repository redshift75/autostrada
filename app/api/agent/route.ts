import { NextRequest, NextResponse } from 'next/server';
import { initializeAgent } from '@/lib/langchain';
import '@/lib/server-only';

// Declare global namespace to add currentListings and currentAuctionResults properties
declare global {
  var currentListings: any[];
  var currentAuctionResults: any[];
}

export async function POST(request: NextRequest) {
  try {
    const { query, context } = await request.json();
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }
    
    // Log the received context for debugging
    console.log('Received context:', JSON.stringify(context, null, 2));
    
    // Initialize the agent
    const agent = await initializeAgent();
    
    // Create a prompt that includes the context if provided
    let enhancedQuery = query;
    
    // Handle listings context
    if (context?.listings && Array.isArray(context.listings) && context.listings.length > 0) {
      // Store the listings in the global context for the analyze_current_listings tool
      global.currentListings = context.listings;
      
      // Format the listings data for the agent
      const listingsData = context.listings.map((listing: any, index: number) => {
        return `Listing #${index + 1}: ${listing.year} ${listing.make} ${listing.model}, Price: $${listing.price}, Mileage: ${listing.mileage} miles, VIN: ${listing.vin}${listing.location ? `, Location: ${listing.location}` : ''}${listing.clickoffURL ? `, URL: ${listing.clickoffURL}` : ''}`;
      }).join('\n');
      
      // Enhance the query with the listings context
      enhancedQuery = `The user is viewing the following car listings:\n\n${listingsData}\n\nUser query: ${query}`;
    } else {
      // Clear the global listings if none are provided
      global.currentListings = [];
    }
    
    // Handle auction results context
    if (context?.auctionResults && Array.isArray(context.auctionResults) && context.auctionResults.length > 0) {
      // Store the auction results in the global context
      global.currentAuctionResults = context.auctionResults;
      
      // Log a sample auction result for debugging
      console.log('Sample auction result:', JSON.stringify(context.auctionResults[0], null, 2));
      
      // Format the auction results data for the agent
      const auctionData = context.auctionResults.map((result: any, index: number) => {
        // Ensure price values are properly formatted
        let soldPrice;
        if (result.status === 'sold' && result.sold_price) {
          if (typeof result.sold_price === 'string') {
            soldPrice = `$${result.sold_price.replace(/[^0-9.]/g, '')}`;
          } else if (typeof result.sold_price === 'number') {
            soldPrice = `$${result.sold_price}`;
          } else {
            soldPrice = 'Not available';
          }
        } else {
          soldPrice = result.price ? `$${result.price}` : 'Not available';
        }
        
        let bidAmount;
        if (result.bid_amount) {
          if (typeof result.bid_amount === 'string') {
            bidAmount = `$${result.bid_amount.replace(/[^0-9.]/g, '')}`;
          } else if (typeof result.bid_amount === 'number') {
            bidAmount = `$${result.bid_amount}`;
          } else {
            bidAmount = 'Not available';
          }
        } else {
          bidAmount = 'Not available';
        }
        
        // Format additional metrics with proper null/undefined checking
        const bidders = typeof result.bidders !== 'undefined' && result.bidders !== null ? 
          `${result.bidders} bidder${result.bidders !== 1 ? 's' : ''}` : 'Bidders: Unknown';
        
        const comments = typeof result.comments !== 'undefined' && result.comments !== null ? 
          `${result.comments} comment${result.comments !== 1 ? 's' : ''}` : 'Comments: Unknown';
        
        const watchers = typeof result.watchers !== 'undefined' && result.watchers !== null ? 
          `${result.watchers} watcher${result.watchers !== 1 ? 's' : ''}` : 'Watchers: Unknown';
        
        const mileage = typeof result.mileage !== 'undefined' && result.mileage !== null ? 
          `${result.mileage.toLocaleString()} miles` : 'Mileage: Unknown';
        
        const formattedResult = `Auction Result #${index + 1}: ${result.title}, ${
          result.status === 'sold' ? 
            `Sold Price: ${soldPrice}` : 
            `Bid Amount: ${bidAmount}`
        }, Status: ${result.status}, Date: ${result.sold_date || 'Not available'}${
          result.url ? `, URL: ${result.url}` : ''
        }, ${mileage}, ${bidders}, ${comments}, ${watchers}`;
        
        // Log the formatted result for debugging
        if (index === 0) {
          console.log('Formatted auction result:', formattedResult);
        }
        
        return formattedResult;
      }).join('\n');
      
      // Enhance the query with the auction results context
      enhancedQuery = `The user is viewing the following car auction results:\n\n${auctionData}\n\nUser query: ${query}`;
      
      // Log the enhanced query for debugging
      console.log('Enhanced query sample (first 200 chars):', enhancedQuery.substring(0, 200) + '...');
    } else {
      // Clear the global auction results if none are provided
      global.currentAuctionResults = [];
    }
    
    // Process the query
    const result = await agent.invoke({
      input: enhancedQuery
    });
    
    // Return the response
    return NextResponse.json({
      response: result.output,
      success: true
    });
  } catch (error) {
    console.error('Error processing agent query:', error);
    return NextResponse.json(
      { error: 'Failed to process query', details: (error as Error).message },
      { status: 500 }
    );
  } finally {
    // Clear the global context after processing
    global.currentListings = [];
    global.currentAuctionResults = [];
  }
}