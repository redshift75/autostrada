import { NextRequest, NextResponse } from 'next/server';
import { BringATrailerActiveListingScraper } from '@/lib/scrapers/BringATrailerActiveListingScraper';
import { BringATrailerResultsScraper } from '@/lib/scrapers/BringATrailerResultsScraper';

// Define the response type for the Deal Finder API
type DealFinderResponse = {
  deals: Array<{
    activeListing: any;
    historicalData: {
      averagePrice: number;
      medianPrice: number;
      minPrice: number;
      maxPrice: number;
      recentSales: any[];
    };
    priceDifference: number;
    percentageDifference: number;
    dealScore: number; // 1-10 score, higher is better deal
    endingSoon: boolean; // Whether the auction is ending within 24 hours
  }>;
};

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const make = searchParams.get('make') || '';
    const model = searchParams.get('model') || '';
    const yearMin = parseInt(searchParams.get('yearMin') || '0') || undefined;
    const yearMax = parseInt(searchParams.get('yearMax') || '0') || undefined;
    const maxDeals = parseInt(searchParams.get('maxDeals') || '10');
    const debug = searchParams.get('debug') === 'true';

    console.log(`Deal Finder API called with params: make=${make}, model=${model}, yearMin=${yearMin}, yearMax=${yearMax}`);

    // Initialize scrapers
    const activeListingScraper = new BringATrailerActiveListingScraper();
    const historicalScraper = new BringATrailerResultsScraper();

    // Fetch active auctions - first get all listings, then filter them
    console.log('Fetching all active listings...');
    const activeListings = await activeListingScraper.scrape();
    console.log(`Fetched ${activeListings.length} active listings`);

    if (debug) {
      // Return more detailed debug information
      return NextResponse.json({ 
        activeListings: activeListings.slice(0, 5),
        totalActiveListings: activeListings.length,
        searchParams: {
          make,
          model,
          yearMin,
          yearMax
        },
        makeModelSamples: activeListings.slice(0, 10).map(l => ({
          title: l.title,
          make: l.make,
          model: l.model,
          year: l.year,
          rawEndDate: l.endDate,
          formattedEndDate: l.endDate ? new Date(l.endDate).toISOString() : 'unknown'
        }))
      });
    }
    
    // Filter by make/model if provided
    let filteredListings = activeListings;
    if (make || model) {
      console.log(`Filtering by make: "${make}" and model: "${model}"`);
      
      // Log a few sample listings before filtering to see what we're working with
      console.log('Sample listings before filtering:');
      activeListings.slice(0, 3).forEach(listing => {
        console.log(`- Title: "${listing.title}", Make: "${listing.make}", Model: "${listing.model}"`);
      });
      
      filteredListings = activeListings.filter(listing => {
        // More robust make matching
        const makeMatch = !make || 
          listing.make.toLowerCase() === make.toLowerCase() || 
          listing.make.toLowerCase().includes(make.toLowerCase()) || 
          listing.title.toLowerCase().includes(make.toLowerCase());
        
        // More robust model matching
        const modelMatch = !model || 
          listing.model.toLowerCase() === model.toLowerCase() || 
          listing.model.toLowerCase().includes(model.toLowerCase()) || 
          listing.title.toLowerCase().includes(model.toLowerCase());
        
        return makeMatch && modelMatch;
      });
    }
    console.log(`After make/model filtering: ${filteredListings.length} listings`);
    
    // Log a few sample listings after filtering
    if (filteredListings.length > 0) {
      console.log('Sample listings after filtering:');
      filteredListings.slice(0, 3).forEach(listing => {
        console.log(`- Title: "${listing.title}", Make: "${listing.make}", Model: "${listing.model}"`);
      });
    }
    
    // Filter by year if provided
    if (yearMin || yearMax) {
      filteredListings = filteredListings.filter(listing => {
        const year = parseInt(listing.year);
        const minMatch = !yearMin || year >= yearMin;
        const maxMatch = !yearMax || year <= yearMax;
        return minMatch && maxMatch;
      });
    }
    console.log(`After year filtering: ${filteredListings.length} listings`);

    // Filter for auctions ending within the next 7 days (instead of just today)
    // This gives us more results to work with
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 7); // Look for auctions ending in the next 7 days
    
    const endingSoon = filteredListings.filter(listing => {
      if (!listing.endDate) {
        console.log(`Listing missing endDate: ${listing.title}`);
        return false;
      }
      
      // The endDate is already in milliseconds, no need to multiply by 1000 again
      const auctionEndDate = new Date(listing.endDate);
      
      // Debug logging for timestamp conversion
      if (listing === filteredListings[0]) {
        console.log(`Debug timestamp conversion for first listing:`);
        console.log(`- Title: ${listing.title}`);
        console.log(`- Raw endDate value: ${listing.endDate}`);
        console.log(`- Converted to Date: ${auctionEndDate.toISOString()}`);
        console.log(`- Current time: ${now.toISOString()}`);
        console.log(`- End date cutoff: ${endDate.toISOString()}`);
        console.log(`- Is ending soon: ${auctionEndDate >= now && auctionEndDate <= endDate}`);
      }
      
      return auctionEndDate >= now && auctionEndDate <= endDate;
    });
    
    console.log(`Auctions ending within 7 days: ${endingSoon.length}`);
    
    if (endingSoon.length === 0) {
      return NextResponse.json({ 
        message: "No auctions ending soon found matching your criteria",
        totalActive: activeListings.length,
        afterFiltering: filteredListings.length,
        sampleListings: filteredListings.slice(0, 3).map(l => ({
          title: l.title,
          make: l.make,
          model: l.model,
          year: l.year,
          endDate: l.endDate ? new Date(l.endDate).toISOString() : 'unknown'
        }))
      });
    }

    // Only fetch historical data if we have active auctions ending soon
    console.log(`Fetching historical data for ${make} ${model}...`);
    const historicalResults = await historicalScraper.scrape({
      make,
      model,
      yearMin,
      yearMax,
      maxPages: 2,
      perPage: 50
    });
    console.log(`Fetched ${historicalResults.length} historical results`);

    // Filter for sold listings only
    const soldListings = historicalResults.filter(listing => listing.status === 'sold');
    console.log(`Found ${soldListings.length} sold listings for comparison`);

    // Calculate deals by comparing active listings with historical data
    const deals = await Promise.all(
      endingSoon.map(async (activeListing) => {
        // Find similar historical listings
        const similarListings = soldListings.filter(historicalListing => {
          // Match by make and model
          const makeMatch = historicalListing.make?.toLowerCase() === activeListing.make.toLowerCase();
          const modelMatch = historicalListing.model?.toLowerCase() === activeListing.model.toLowerCase();
          
          // Match by year (within 2 years)
          const yearDiff = Math.abs(
            parseInt(historicalListing.year?.toString() || '0') - 
            parseInt(activeListing.year || '0')
          );
          const yearMatch = yearDiff <= 2;
          
          return makeMatch && modelMatch && yearMatch;
        });

        // If no similar listings found, skip this listing
        if (similarListings.length === 0) {
          return null;
        }

        // Calculate average, median, min, and max prices
        const prices = similarListings.map(listing => 
          parseInt(listing.sold_price.replace(/[^0-9]/g, ''))
        );
        
        prices.sort((a, b) => a - b);
        
        const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        const medianPrice = prices.length % 2 === 0 
          ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
          : prices[Math.floor(prices.length / 2)];
        const minPrice = prices[0];
        const maxPrice = prices[prices.length - 1];

        // Get current bid
        const currentBid = activeListing.current_bid;

        // Calculate price difference
        const priceDifference = averagePrice - currentBid;
        const percentageDifference = (priceDifference / averagePrice) * 100;

        // Calculate deal score (1-10)
        // Higher percentage difference = better deal
        let dealScore = 5; // Default neutral score
        
        if (percentageDifference > 0) {
          // Positive percentage difference means it's underpriced
          dealScore = Math.min(10, 5 + Math.floor(percentageDifference / 5));
        } else {
          // Negative percentage difference means it's overpriced
          dealScore = Math.max(1, 5 - Math.floor(Math.abs(percentageDifference) / 5));
        }

        // Check if ending soon (within 24 hours)
        const endDate = new Date(activeListing.endDate);
        const hoursRemaining = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        const endingSoon = hoursRemaining <= 24;

        // Get recent sales (last 5)
        const recentSales = similarListings
          .sort((a, b) => new Date(b.sold_date).getTime() - new Date(a.sold_date).getTime())
          .slice(0, 5);

        return {
          activeListing,
          historicalData: {
            averagePrice,
            medianPrice,
            minPrice,
            maxPrice,
            recentSales
          },
          priceDifference,
          percentageDifference,
          dealScore,
          endingSoon
        };
      })
    );

    // Filter out null values and sort by deal score (highest first)
    const validDeals = deals
      .filter(deal => deal !== null)
      .sort((a, b) => b!.dealScore - a!.dealScore)
      .slice(0, maxDeals);
    
    console.log(`Found ${validDeals.length} valid deals`);

    return NextResponse.json({ deals: validDeals });
  } catch (error) {
    console.error('Error finding deals:', error);
    return NextResponse.json(
      { error: 'Failed to find deals', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 