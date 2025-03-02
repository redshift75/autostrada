import { NextResponse } from 'next/server';

// Define the response type for Auto.dev API based on actual response
type AutoDevListingsResponse = {
  totalCount: number;
  totalCountFormatted: string;
  hitsCount: number;
  records: Array<{
    id: number;
    vin: string;
    displayColor: string | null;
    year: number;
    make: string;
    model: string;
    price: string;
    mileage: string;
    city: string;
    state: string;
    primaryPhotoUrl: string;
    trim: string;
    bodyStyle: string;
    dealerName: string;
    mileageUnformatted: number;
    priceUnformatted: number;
    photoUrls: string[];
    description?: string;
    clickoffUrl: string;
    createdAt: string;
    updatedAt: string;
  }>;
};

// Define a type for the transformed listing item
type TransformedListing = {
  title: string;
  price: number;
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
  year: number;
  vin: string;
};

// Helper function to ensure URLs have proper protocol
function ensureAbsoluteUrl(url: string | null): string | null {
  if (!url) return null;
  
  // If the URL starts with '//', add https: to make it absolute
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
   
  // If the URL is relative (starts with '/'), add the base domain
  if (url.startsWith('/') && !url.startsWith('//')) {
    return `https://auto.dev${url}`;
  }
  
  // If the URL already has a protocol, return it as is
  return url;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { make, model, yearMin, yearMax, maxResults = 50 } = body;

    // Validate required parameters
    if (!make) {
      return NextResponse.json(
        { error: 'Make is required' },
        { status: 400 }
      );
    }

    // Get API key from environment variables
    const apiKey = process.env.AUTO_DEV_API_KEY;
    const useMockData = !apiKey || process.env.USE_MOCK_DATA === 'true';
    
    let transformedListings: TransformedListing[] = [];
    let totalResults = 0;
    
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
      params.append('make', make);
      if (model) params.append('model', model);
      if (yearMin) params.append('year_min', yearMin.toString());
      if (yearMax) params.append('year_max', yearMax.toString());
      params.append('limit', maxResults.toString());

      // Call Auto.dev API
      const response = await fetch(
        `https://auto.dev/api/listings?${params.toString()}`,
        {
          headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Auto.dev API error:', response.status, errorText);
        return NextResponse.json(
          { error: `API error: ${response.status}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      console.log('Auto.dev API response structure:', Object.keys(data));
      
      // Check if data has the expected structure
      if (!data) {
        console.error('Empty API response');
        return NextResponse.json(
          { 
            error: 'Empty API response',
            results: [],
            pagination: { totalResults: 0, totalPages: 0, currentPage: 0 },
            summary: { totalResults: 0, averagePrice: 0, highestPrice: 0, lowestPrice: 0 },
            visualizations: null
          },
          { status: 200 }
        );
      }
      
      // Handle the actual API response format
      if (data.records && Array.isArray(data.records)) {
        // Using the actual response format
        totalResults = data.totalCount || data.records.length;
        
        transformedListings = data.records.map((record: any) => {
          // Parse price from string to number
          let priceValue = 0;
          if (record.priceUnformatted) {
            priceValue = record.priceUnformatted;
          } else if (record.price && typeof record.price === 'string' && record.price !== 'accepting_offers') {
            // Remove non-numeric characters and convert to number
            priceValue = parseInt(record.price.replace(/[^0-9]/g, '')) || 0;
          }
          
          // Parse mileage from string to number
          let mileageValue = 0;
          if (record.mileageUnformatted) {
            mileageValue = record.mileageUnformatted;
          } else if (record.mileage && typeof record.mileage === 'string') {
            // Remove non-numeric characters and convert to number
            mileageValue = parseInt(record.mileage.replace(/[^0-9]/g, '')) || 0;
          }
          
          // Ensure image URLs have proper protocols
          const primaryPhotoUrl = ensureAbsoluteUrl(record.primaryPhotoUrl);
          const thumbnailUrl = ensureAbsoluteUrl(record.thumbnailUrl || record.primaryPhotoUrl || '');
          const thumbnailUrlLarge = ensureAbsoluteUrl(record.thumbnailUrlLarge || record.primaryPhotoUrl || '');
          
          return {
            title: `${record.year} ${record.make} ${record.model} ${record.trim || ''}`.trim(),
            price: priceValue,
            mileage: mileageValue,
            exterior_color: record.displayColor || null,
            interior_color: null,
            drive_train: null,
            transmission: null,
            engine: null,
            body_style: record.bodyStyle || null,
            fuel_type: null,
            mpg_city: null,
            mpg_highway: null,
            url: record.clickoffUrl || '',
            image_url: primaryPhotoUrl,
            images: record.photoUrls && record.photoUrls.length > 0 ? { 
              small: { 
                url: thumbnailUrl, 
                width: 300, 
                height: 200 
              },
              large: { 
                url: thumbnailUrlLarge, 
                width: 800, 
                height: 600 
              }
            } : null,
            dealer: {
              name: record.dealerName || '',
              address: null,
              city: record.city || '',
              state: record.state || '',
              zip: null,
              phone: null
            },
            description: record.description || `${record.year} ${record.make} ${record.model} ${record.trim || ''}`,
            listed_date: record.updatedAt || record.createdAt || new Date().toISOString(),
            make: record.make,
            model: record.model,
            year: record.year,
            vin: record.vin,
          };
        });
      } else if (data.listings && Array.isArray(data.listings)) {
        // Using the expected response format from the original code
        totalResults = data.pagination?.totalResults || data.listings.length;
        
        transformedListings = data.listings.map((listing: any) => {
          // Ensure image URLs have proper protocols
          const imageUrls = listing.images && listing.images.length > 0 
            ? listing.images.map((url: string) => ensureAbsoluteUrl(url))
            : [];
          
          return {
            title: `${listing.year} ${listing.make} ${listing.model} ${listing.trim || ''}`.trim(),
            price: listing.price,
            mileage: listing.mileage,
            exterior_color: listing.exteriorColor,
            interior_color: listing.interiorColor,
            drive_train: listing.driveTrain,
            transmission: listing.transmission,
            engine: listing.engine,
            body_style: listing.bodyStyle,
            fuel_type: listing.fuelType,
            mpg_city: listing.mpgCity,
            mpg_highway: listing.mpgHighway,
            url: listing.clickoffUrl,
            image_url: imageUrls.length > 0 ? imageUrls[0] : null,
            images: imageUrls.length > 0 ? { 
              small: { url: imageUrls[0], width: 300, height: 200 },
              large: imageUrls.length > 1 ? { url: imageUrls[1], width: 800, height: 600 } : { url: imageUrls[0], width: 800, height: 600 }
            } : null,
            dealer: listing.dealer,
            description: listing.description,
            listed_date: listing.listedDate,
            make: listing.make,
            model: listing.model,
            year: listing.year,
            vin: listing.vin,
          };
        });
      } else {
        console.error('Unexpected API response format:', data);
        return NextResponse.json(
          { 
            error: 'Unexpected API response format',
            results: [],
            pagination: { totalResults: 0, totalPages: 0, currentPage: 0 },
            summary: { totalResults: 0, averagePrice: 0, highestPrice: 0, lowestPrice: 0 },
            visualizations: null
          },
          { status: 200 }
        );
      }
    }

    // Calculate summary statistics
    const validPrices = transformedListings.filter(item => item.price > 0).map(item => item.price);
    const averagePrice = validPrices.length > 0 
      ? Math.round(validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length) 
      : 0;
    const highestPrice = validPrices.length > 0 ? Math.max(...validPrices) : 0;
    const lowestPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;

    // Transform data to match the format expected by the frontend
    const transformedData = {
      results: transformedListings,
      pagination: { 
        totalResults: totalResults, 
        totalPages: Math.ceil(totalResults / maxResults), 
        currentPage: 1 
      },
      summary: {
        totalResults: totalResults,
        averagePrice,
        highestPrice,
        lowestPrice,
      },
      // Generate visualizations data
      visualizations: generateVisualizations(transformedListings),
    };

    return NextResponse.json(transformedData);
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
    .filter(listing => listing.price > 0) // Filter out listings with no price
    .map(listing => ({
      price: listing.price,
      make: listing.make,
      model: listing.model,
      year: listing.year,
      mileage: listing.mileage,
      date: new Date(listing.listed_date).toISOString(),
    }));

  if (priceData.length === 0) {
    return null;
  }

  // Create price histogram specification
  const priceHistogram = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    description: 'Listing Price Distribution',
    data: { values: priceData },
    mark: 'bar',
    encoding: {
      x: {
        bin: { maxbins: 20 },
        field: 'price',
        title: 'Price ($)'
      },
      y: {
        aggregate: 'count',
        title: 'Number of Listings'
      },
      tooltip: [
        { field: 'price', bin: true, title: 'Price Range' },
        { aggregate: 'count', title: 'Number of Listings' }
      ]
    }
  };

  // Create price vs. mileage scatter plot
  const priceVsMileage = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    description: 'Price vs. Mileage',
    data: { values: priceData },
    mark: 'point',
    encoding: {
      x: {
        field: 'mileage',
        type: 'quantitative',
        title: 'Mileage'
      },
      y: {
        field: 'price',
        type: 'quantitative',
        title: 'Price ($)'
      },
      tooltip: [
        { field: 'year', type: 'ordinal', title: 'Year' },
        { field: 'make', type: 'nominal', title: 'Make' },
        { field: 'model', type: 'nominal', title: 'Model' },
        { field: 'price', type: 'quantitative', title: 'Price', format: '$,.0f' },
        { field: 'mileage', type: 'quantitative', title: 'Mileage', format: ',.0f' }
      ]
    }
  };

  return {
    priceHistogram,
    priceVsMileage
  };
} 