import { NextRequest, NextResponse } from 'next/server';
import { initializeAgent } from '@/lib/langchain';
import '@/lib/server-only';

// Declare global namespace to add currentListings property
declare global {
  var currentListings: any[];
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
    
    // Initialize the agent
    const agent = await initializeAgent();
    
    // Create a prompt that includes the listings context if provided
    let enhancedQuery = query;
    
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
    // Clear the global listings after processing
    global.currentListings = [];
  }
}