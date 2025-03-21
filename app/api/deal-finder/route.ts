import { NextRequest, NextResponse } from 'next/server';
import { BringATrailerActiveListingScraper } from '@/lib/scrapers/BringATrailerActiveListingScraper';
import { fetchDetailsFromListingPage } from '@/lib/scrapers/BATDetailsExtractor';
import { auth } from '@clerk/nextjs/server'

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
    // Get the token from session
    const { getToken } = await auth()
    const token = await getToken()

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const make = searchParams.get('make') || '';
    const model = searchParams.get('model') || '';
    const yearMin = parseInt(searchParams.get('yearMin') || '0') || undefined;
    const yearMax = parseInt(searchParams.get('yearMax') || '0') || undefined;
    const maxDeals = parseInt(searchParams.get('maxDeals') || '10');

    // Initialize scraper for active listings
    const activeListingScraper = new BringATrailerActiveListingScraper();

    // Fetch active auctions - first get all listings, then filter them
    const activeListings = await activeListingScraper.scrape();
    console.log(`Fetched ${activeListings.length} active listings`);
    
    // Filter by make/model if provided
    let filteredListings = activeListings;
    if (make || model) {
      console.log(`Filtering by make: "${make}" and model: "${model}"`);
      
      filteredListings = activeListings.filter(listing => {
        // More robust make matching
        const makeMatch = !make || 
          listing.make.toLowerCase() === make.toLowerCase() || 
          listing.make.toLowerCase().includes(make.toLowerCase()) || 
          listing.title.toLowerCase().includes(make.toLowerCase());
        
        const modelMatch = !model || 
          listing.model.toLowerCase() === model.toLowerCase() || 
          listing.model.toLowerCase().includes(model.toLowerCase()) || 
          listing.title.toLowerCase().includes(model.toLowerCase());
        return makeMatch && modelMatch;
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
    console.log(`After filtering: ${filteredListings.length} listings`);

    // Filter for auctions ending within the next 3 days (instead of just today)
    // This gives us more results to work with
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 3); // Look for auctions ending in the next 3 days

    let endingSoon = filteredListings.filter(listing => {
      if (!listing.endDate) {
        console.log(`Listing missing endDate: ${listing.title}`);
        return false;
      }
      
      // The endDate is already in milliseconds, no need to multiply by 1000 again
      const auctionEndDate = new Date(listing.endDate);
      
      return auctionEndDate >= now && auctionEndDate <= endDate;
    });

    endingSoon = endingSoon.slice(0, maxDeals);
    console.log(`Auctions ending soon : ${endingSoon.length}`);
    
    if (endingSoon.length === 0) {
      return NextResponse.json({ 
        message: "No auctions ending soon found matching your criteria",
        totalActive: activeListings.length,
        afterFiltering: filteredListings.length
      });
    }
    
    // Calculate deals by comparing active listings with historical data
    const deals = await Promise.all(
      endingSoon.map(async (activeListing) => {
        // Fetch historical data for this specific make/model/year range using the auction results API
        const listingMake = activeListing.make;
        // Extract model from the listing title using the listing's make
        const listingModel = activeListing.model;
        const listingYear = parseInt(activeListing.year);
        
        // Set year range to be within 2 years of the active listing's year
        const histYearMin = listingYear - 2;
        const histYearMax = listingYear + 2;
        
        console.log(`Fetching historical data for ${listingMake} ${listingModel} (${histYearMin}-${histYearMax})...`);
        
        // Call the auction results API
        const resultsResponse = await fetch(new URL('/api/auction/results', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            make: listingMake,
            model: listingModel,
            yearMin: histYearMin,
            yearMax: histYearMax,
            maxPages: 1
          }),
        });
        
        if (!resultsResponse.ok) {
          console.error(`Failed to fetch historical data for ${listingMake} ${listingModel}: ${resultsResponse.status}`);
          return null;
        }
        
        const resultsData = await resultsResponse.json();
        const historicalResults = resultsData.results || [];
        
        // Filter for sold listings only
        const soldListings = historicalResults.filter((listing: any) => listing.status === 'sold');
        console.log(`Found ${soldListings.length} sold listings for comparison with ${histYearMin}-${histYearMax} ${listingMake} ${listingModel}`);

        // If no similar listings found, skip this listing
        if (soldListings.length === 0) {
          return null;
        }

        // Calculate average, median, min, and max prices
        const prices = soldListings.map((listing: any) => {
          // Extract numeric price from sold_price string (e.g., "$50,000" -> 50000)
          const priceStr = listing.sold_price;
          return typeof priceStr === 'string' 
            ? parseInt(priceStr.replace(/[^0-9]/g, '')) 
            : (typeof listing.price === 'number' ? listing.price : 0);
        }).filter((price: number) => price > 0);
        
        if (prices.length === 0) {
          return null;
        }
        
        prices.sort((a: number, b: number) => a - b);
        
        const averagePrice = prices.reduce((sum: number, price: number) => sum + price, 0) / prices.length;
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
        const auctionEndDate = new Date(activeListing.endDate);
        const hoursRemaining = (auctionEndDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        const endingSoon = hoursRemaining <= 24;

        // Get recent sales (last 5)
        const recentSales = soldListings
          .sort((a: any, b: any) => new Date(b.sold_date).getTime() - new Date(a.sold_date).getTime())
          .slice(0, 25);

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
      .sort((a, b) => b!.dealScore - a!.dealScore);
    
    // Get mileage from listing page
    for (const validDeal of validDeals) {
      const data = await fetchDetailsFromListingPage(validDeal.activeListing.url);
      validDeal.activeListing.mileage = data.mileage;
    }

    console.log(`Found ${validDeals.length} valid deals`);

    return NextResponse.json({ 
      deals: validDeals,
      activeListings: activeListings
    });
  } catch (error) {
    console.error('Error finding deals:', error);
    return NextResponse.json(
      { error: 'Failed to find deals', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 