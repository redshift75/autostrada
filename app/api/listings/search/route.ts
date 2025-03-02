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

// Mock data for testing when API key is not available
const generateMockListings = (make: string, model?: string, yearMin?: number, yearMax?: number): TransformedListing[] => {
  const currentYear = new Date().getFullYear();
  const makes = ['Toyota', 'Honda', 'Ford', 'BMW', 'Mercedes', 'Audi', 'Tesla'];
  const models = {
    Toyota: ['Camry', 'Corolla', 'RAV4', 'Highlander', 'Tacoma'],
    Honda: ['Civic', 'Accord', 'CR-V', 'Pilot', 'Odyssey'],
    Ford: ['F-150', 'Mustang', 'Explorer', 'Escape', 'Edge'],
    BMW: ['3 Series', '5 Series', 'X3', 'X5', '7 Series'],
    Mercedes: ['C-Class', 'E-Class', 'GLC', 'GLE', 'S-Class'],
    Audi: ['A4', 'A6', 'Q5', 'Q7', 'e-tron'],
    Tesla: ['Model 3', 'Model Y', 'Model S', 'Model X', 'Cybertruck']
  };
  
  const transmissions = ['Automatic', 'Manual', 'CVT', 'Dual-Clutch'];
  const driveTrains = ['FWD', 'RWD', 'AWD', '4WD'];
  const colors = ['Black', 'White', 'Silver', 'Gray', 'Red', 'Blue', 'Green'];
  const fuelTypes = ['Gasoline', 'Diesel', 'Hybrid', 'Electric'];
  const bodyStyles = ['Sedan', 'SUV', 'Truck', 'Coupe', 'Convertible', 'Hatchback'];
  
  // Filter by make
  const selectedMake = makes.includes(make) ? make : makes[Math.floor(Math.random() * makes.length)];
  
  // Generate between 5 and 20 listings
  const count = Math.floor(Math.random() * 15) + 5;
  const mockListings: TransformedListing[] = [];
  
  for (let i = 0; i < count; i++) {
    // Select model based on make or use provided model
    const availableModels = models[selectedMake as keyof typeof models] || models.Toyota;
    const selectedModel = model || availableModels[Math.floor(Math.random() * availableModels.length)];
    
    // Generate a year between yearMin/yearMax or between 5 years ago and current year
    const minYear = yearMin || currentYear - 5;
    const maxYear = yearMax || currentYear;
    const year = Math.floor(Math.random() * (maxYear - minYear + 1)) + minYear;
    
    // Generate a random price between $10,000 and $80,000
    const price = Math.floor(Math.random() * 70000) + 10000;
    
    // Generate random mileage based on age of car (newer cars have less mileage)
    const ageInYears = currentYear - year;
    const baseMileage = ageInYears * 12000; // Average 12,000 miles per year
    const mileageVariance = baseMileage * 0.3; // 30% variance
    const mileage = Math.floor(baseMileage + (Math.random() * mileageVariance * 2) - mileageVariance);
    
    // Generate other random properties
    const transmission = transmissions[Math.floor(Math.random() * transmissions.length)];
    const driveTrain = driveTrains[Math.floor(Math.random() * driveTrains.length)];
    const exteriorColor = colors[Math.floor(Math.random() * colors.length)];
    const interiorColor = colors[Math.floor(Math.random() * colors.length)];
    const fuelType = fuelTypes[Math.floor(Math.random() * fuelTypes.length)];
    const bodyStyle = bodyStyles[Math.floor(Math.random() * bodyStyles.length)];
    
    // Generate a random ID and VIN
    const vin = `MOCK${Math.random().toString(36).substring(2, 12).toUpperCase()}`;
    
    // Generate a random listing date within the last 30 days
    const daysAgo = Math.floor(Math.random() * 30);
    const listedDate = new Date();
    listedDate.setDate(listedDate.getDate() - daysAgo);
    
    // Create a mock listing
    mockListings.push({
      title: `${year} ${selectedMake} ${selectedModel} ${Math.random() > 0.5 ? 'SE' : 'LE'}`.trim(),
      price,
      mileage,
      exterior_color: exteriorColor,
      interior_color: interiorColor,
      drive_train: driveTrain,
      transmission,
      engine: `${Math.floor(Math.random() * 3) + 2}.${Math.floor(Math.random() * 9)}L ${Math.floor(Math.random() * 6) + 4} Cylinder`,
      body_style: bodyStyle,
      fuel_type: fuelType,
      mpg_city: Math.floor(Math.random() * 15) + 15,
      mpg_highway: Math.floor(Math.random() * 15) + 25,
      url: 'https://example.com/car-listing',
      image_url: 'https://placehold.co/600x400/png?text=Car+Image',
      images: { 
        small: { url: 'https://placehold.co/600x400/png?text=Car+Image', width: 300, height: 200 },
        large: { url: 'https://placehold.co/800x600/png?text=Car+Image+Large', width: 800, height: 600 }
      },
      dealer: {
        name: `${selectedMake} of ${['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'][Math.floor(Math.random() * 5)]}`,
        address: `${Math.floor(Math.random() * 9000) + 1000} Main St`,
        city: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'][Math.floor(Math.random() * 5)],
        state: ['NY', 'CA', 'IL', 'TX', 'AZ'][Math.floor(Math.random() * 5)],
        zip: `${Math.floor(Math.random() * 90000) + 10000}`,
        phone: `(${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`
      },
      description: `This ${year} ${selectedMake} ${selectedModel} is in excellent condition with ${mileage.toLocaleString()} miles. It features a ${transmission} transmission, ${driveTrain} drive train, and a beautiful ${exteriorColor} exterior with ${interiorColor} interior.`,
      listed_date: listedDate.toISOString(),
      make: selectedMake,
      model: selectedModel,
      year,
      vin,
    });
  }
  
  return mockListings;
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
      console.log('Using mock data for Auto.dev API');
      // Generate mock data
      transformedListings = generateMockListings(make, model, yearMin, yearMax);
      totalResults = transformedListings.length;
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