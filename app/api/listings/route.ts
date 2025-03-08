import { NextResponse } from 'next/server';
import { generateHistogram, generateScatterPlot } from '../../../lib/utils/visualization';

// Define the response type for MarketCheck API based on actual response
type MarketCheckListingsResponse = {
  num_found: number;
  listings: Array<{
    id: string;
    vin: string;
    heading: string;
    price?: number | null;
    miles?: number;
    msrp?: number;
    vdp_url: string;
    exterior_color?: string;
    interior_color?: string;
    seller_type?: string;
    inventory_type?: string;
    stock_no?: string;
    last_seen_at_date?: string;
    first_seen_at_date?: string;
    source?: string;
    media?: {
      photo_links?: string[];
      photo_links_cached?: string[];
    };
    dealer?: {
      id?: number;
      website?: string;
      name?: string;
      dealer_type?: string;
      street?: string;
      city?: string;
      state?: string;
      country?: string;
      zip?: string;
      phone?: string;
    };
    build?: {
      year: number;
      make: string;
      model: string;
      trim?: string;
      version?: string;
      body_type?: string;
      vehicle_type?: string;
      transmission?: string;
      drivetrain?: string;
      fuel_type?: string;
      engine?: string;
      engine_size?: number;
      doors?: number;
      cylinders?: number;
      highway_mpg?: number;
      city_mpg?: number;
    };
  }>;
};

// Define a type for the transformed listing item
type TransformedListing = {
  title: string;
  price: number | null;
  mileage: number;
  exterior_color: string | null;
  interior_color: string | null;
  drive_train: string | null;
  transmission: string | null;
  engine: string | null;
  body_style: string | null;
  fuel_type: string | null;
  mpg_city: number | null;
  mpg_highway: number | null;
  url: string;
  image_url: string | null;
  images: {
    small: { url: string; width: number; height: number };
    large: { url: string; width: number; height: number };
  } | null;
  dealer: {
    name: string;
    address: string | null;
    city: string;
    state: string;
    zip: string | null;
    phone: string | null;
  };
  description: string;
  listed_date: string;
  make: string;
  model: string;
  version: string;
  year: number;
  vin: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { make, model, yearMin, yearMax, transmission, maxResults = 100 } = body;

    // Validate required parameters
    if (!make) {
      return NextResponse.json(
        { error: 'Make is required' },
        { status: 400 }
      );
    }

    // Get API key from environment variables
    const apiKey = process.env.MARKETCHECK_API_KEY;
    const useMockData = !apiKey || process.env.USE_MOCK_DATA === 'true';
    
    let transformedListings: TransformedListing[] = [];
    
    if (useMockData) {
      console.log('Mock data generation has been removed');
      return NextResponse.json({
        results: [],
        pagination: { totalResults: 0, totalPages: 0, currentPage: 0 },
        summary: { totalResults: 0, averagePrice: 0, highestPrice: 0, lowestPrice: 0 },
        visualizations: null,
        message: 'Mock data generation has been removed. Please configure a valid API key.'
      });
    } else {
      // Build query parameters
      const params = new URLSearchParams();
      params.append('api_key', apiKey);
      params.append('make', make);
      // Use version instead of model for MarketCheck API
      if (model) params.append('version', model);

      if (yearMin && yearMax && yearMin === yearMax) {
        params.append('year', yearMin.toString());
      } else if (yearMin && yearMax) {
        // Create a comma-separated list of years between yearMin and yearMax
        const years = [];
        for (let year = parseInt(yearMin); year <= parseInt(yearMax); year++) {
          years.push(year);
        }
        params.append('year', years.join(','));
      }
      // Add transmission filter if specified
      if (transmission) {
        params.append('transmission', transmission);
      }

      // Set a reasonable limit for results
      params.append('rows', maxResults.toString());
      
      // Call MarketCheck API
      const response = await fetch(
        `https://mc-api.marketcheck.com/v2/search/car/active?${params.toString()}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('MarketCheck API error:', response.status, errorText);
        return NextResponse.json(
          { error: `API error: ${response.status}` },
          { status: response.status }
        );
      }

      const data: MarketCheckListingsResponse = await response.json();
      
      // Check if data has the expected structure
      if (!data || !data.listings) {
        console.error('Empty API response or missing listings array');
        return NextResponse.json(
          { 
            error: 'Empty API response or missing listings array',
            results: [],
            pagination: { totalResults: 0, totalPages: 0, currentPage: 0 },
            summary: { totalResults: 0, averagePrice: 0, highestPrice: 0, lowestPrice: 0 },
            visualizations: null
          },
          { status: 200 }
        );
      }
      
      // First map all listings to the transformed format
      const allTransformedListings = data.listings.map((listing) => {
        // Get the primary image URL
        const photoLinks = listing.media?.photo_links || [];
        const primaryImageUrl = photoLinks.length > 0 ? photoLinks[0] : null;

        // Get a secondary image for the large view if available
        const secondaryImageUrl = photoLinks.length > 1 ? photoLinks[1] : null;
                                 
        // Extract year, make, model from build or from heading
        const year = listing.build?.year || parseInt(listing.heading?.split(' ')[0] || '0');
        const make = listing.build?.make || '';
        const model = listing.build?.model || '';
        const trim = listing.build?.trim || '';
        
        return {
          title: listing.heading || `${year} ${make} ${model} ${trim}`.trim(),
          price: listing.price || null,
          mileage: listing.miles || 0,
          exterior_color: listing.exterior_color || null,
          interior_color: listing.interior_color || null,
          drive_train: listing.build?.drivetrain || null,
          transmission: listing.build?.transmission || null,
          engine: listing.build?.engine || null,
          body_style: listing.build?.body_type || null,
          fuel_type: listing.build?.fuel_type || null,
          mpg_city: listing.build?.city_mpg || null,
          mpg_highway: listing.build?.highway_mpg || null,
          url: listing.vdp_url || '',
          image_url: primaryImageUrl,
          images: primaryImageUrl ? { 
            small: { 
              url: primaryImageUrl, 
              width: 300, 
              height: 200 
            },
            large: { 
              url: secondaryImageUrl || primaryImageUrl, 
              width: 800, 
              height: 600 
            }
          } : null,
          dealer: {
            name: listing.dealer?.name || '',
            address: listing.dealer?.street || null,
            city: listing.dealer?.city || '',
            state: listing.dealer?.state || '',
            zip: listing.dealer?.zip || null,
            phone: listing.dealer?.phone || null
          },
          description: listing.heading || `${year} ${make} ${model} ${trim}`,
          listed_date: listing.first_seen_at_date || new Date().toISOString(),
          make: make,
          model: model,
          version: listing.build?.version || '',
          year: year,
          vin: listing.vin || '',
        };
      });

      // Filter out listings with null or undefined prices
      transformedListings = allTransformedListings.filter(listing => 
        listing.price !== null && listing.price !== undefined
      );

      // Update totalResults to reflect the filtered count
      const filteredTotalResults = transformedListings.length;

      // Calculate summary statistics directly from transformedListings
      // All prices are guaranteed to be valid numbers at this point
      const prices = transformedListings.map(item => item.price as number);
      
      const averagePrice = prices.length > 0 
        ? Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length) 
        : 0;
      
      const highestPrice = prices.length > 0 
        ? Math.max(...prices) 
        : 0;
      
      const lowestPrice = prices.length > 0 
        ? Math.min(...prices) 
        : 0;

      // Transform data to match the format expected by the frontend
      const transformedData = {
        results: transformedListings,
        pagination: { 
          totalResults: filteredTotalResults, 
          totalPages: Math.ceil(filteredTotalResults / maxResults), 
          currentPage: 1 
        },
        summary: {
          totalResults: filteredTotalResults,
          averagePrice,
          highestPrice,
          lowestPrice,
        },
        // Generate visualizations data
        visualizations: generateVisualizations(transformedListings),
      };

      return NextResponse.json(transformedData);
    }
  } catch (error) {
    console.error('Error processing listings request:', error);
    // Return a graceful error response with empty data structure
    return NextResponse.json(
      { 
        error: 'Internal server error',
        results: [],
        pagination: { totalResults: 0, totalPages: 0, currentPage: 0 },
        summary: { totalResults: 0, averagePrice: 0, highestPrice: 0, lowestPrice: 0 },
        visualizations: null
      },
      { status: 500 }
    );
  }
}

// Helper function to generate visualizations
function generateVisualizations(listings: TransformedListing[]) {
  if (!listings || listings.length === 0) {
    return null;
  }

  // Prepare data for visualizations
  const priceData = listings
    .filter(listing => listing.price !== null) // Filter out listings with no price
    .map(listing => ({
      price: listing.price,
      make: listing.make,
      model: listing.model,
      year: listing.year,
      mileage: listing.mileage,
      title: `${listing.year} ${listing.make} ${listing.model}`,
      url: listing.url,
      date: new Date(listing.listed_date).toISOString(),
    }));

  if (priceData.length === 0) {
    return null;
  }

  // Create price histogram using the new generateHistogram function
  const priceHistogram = generateHistogram(priceData, {
    field: 'price',
    description: 'Listing Price Distribution',
    xAxisTitle: 'Price ($)',
    yAxisTitle: 'Number of Vehicles',
    filter: (listing) => listing.price !== null,
    additionalFields: ['title', 'url', 'year', 'make', 'model'],
    interactive: true
  });

  // Create price vs. mileage scatter plot using the refactored function
  const priceVsMileage = generateScatterPlot(
    priceData,
    'mileage',
    'price',
    {
      description: 'Price vs. Mileage',
      xAxisTitle: 'Mileage',
      yAxisTitle: 'Price ($)',
      tooltipFields: [
        { field: 'year', title: 'Year', type: 'ordinal' },
        { field: 'make', title: 'Make', type: 'nominal' },
        { field: 'model', title: 'Model', type: 'nominal' },
        { field: 'price', title: 'Price', format: '$,.0f', type: 'quantitative' },
        { field: 'mileage', title: 'Mileage', format: ',.0f', type: 'quantitative' }
      ]
    }
  );

  return {
    priceHistogram,
    priceVsMileage
  };
} 