import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Check if Supabase credentials are configured
const isSupabaseConfigured = supabaseUrl && supabaseKey;

// Create client only if credentials are available
const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseKey) : null;

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
    predicted_price: number | null;
    dealScore: number; // 1-10 score, higher is better deal
    endingSoon: boolean; // Whether the auction is ending within 24 hours
  }>;
};

export async function GET(request: NextRequest) {
  try {
    // Check if Supabase is configured
    if (!isSupabaseConfigured || !supabase) {
      console.error('Supabase environment variables are not configured');
      return NextResponse.json(
        { error: 'Database connection not configured. Check server environment variables.' }, 
        { status: 503 }
      );
    }

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

    // Build the Supabase query for active auctions
    let query = supabase
      .from('bat_active_auctions')
      .select('*')
      .eq('status', 'active');

    // Apply filters if provided
    if (make) {
      query = query.ilike('make', `%${make}%`);
    }
    if (model) {
      query = query.ilike('model', `%${model}%`);
    }
    if (yearMin) {
      query = query.gte('year', yearMin);
    }
    if (yearMax) {
      query = query.lte('year', yearMax);
    }

    // Execute the query
    const { data: activeListings, error } = await query;

    if (error) {
      console.error('Error fetching active listings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch active listings from database' },
        { status: 500 }
      );
    }

    console.log(`Fetched ${activeListings.length} active listings from database`);

    // Filter for auctions ending within the next 3 days
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 3);

    let endingSoon = activeListings.filter(listing => {
      if (!listing.endDate) {
        console.log(`Listing missing endDate: ${listing.title}`);
        return false;
      }
      
      const auctionEndDate = new Date(listing.endDate);
      return auctionEndDate >= now && auctionEndDate <= endDate;
    });

    endingSoon = endingSoon.slice(0, maxDeals);
    console.log(`Auctions ending soon: ${endingSoon.length}`);
    
    if (endingSoon.length === 0) {
      return NextResponse.json({ 
        message: "No auctions ending soon found matching your criteria",
        totalActive: activeListings.length,
        afterFiltering: endingSoon.length
      });
    }
    
    // Calculate deals by comparing active listings with historical data
    const deals = await Promise.all(
      endingSoon.map(async (activeListing) => {
        // Fetch historical data for this specific make/model/year range using the auction results API
        const listingMake = activeListing.make;
        const listingModel = activeListing.model;
        const listingYear = activeListing.year;
        
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
          .sort((a: any, b: any) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())
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
          predicted_price: activeListing.predicted_price || null,
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