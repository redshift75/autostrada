import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Price prediction API endpoint
const PREDICTION_API_URL = 'http://Gmolinari.pythonanywhere.com/models/predict';

interface PricePrediction {
  prediction: number;
}

interface ActiveListing {
  listing_id: string;
  make: string;
  model: string;
  year: number;
  mileage: number | null;
  normalized_color: string | null;
  transmission: string | null;
  predicted_price?: number;
}

async function getPredictedPrice(listing: ActiveListing): Promise<number | null> {
  try {
    // Skip if required fields are missing
    if (!listing.make || !listing.model || !listing.year) {
      console.log(`Skipping listing ${listing.listing_id}: Missing required fields`);
      return null;
    }

    const response = await axios.post<PricePrediction>(PREDICTION_API_URL, {
      make: listing.make,
      model: listing.model,
      year: listing.year,
      mileage: listing.mileage,
      normalized_color: listing.normalized_color,
      transmission: listing.transmission
    });
    console.log(`Prediction for ${listing.make} ${listing.model}:`, response.data.prediction);
    return response.data.prediction;
  } catch (error) {
    console.error(`Error getting prediction :`, error);
    return null;
  }
}

async function updateListingWithPrediction(listingId: string, predictedPrice: number) {
  try {
    const { error } = await supabase
      .from('bat_active_auctions')
      .update({ predicted_price: predictedPrice })
      .eq('listing_id', listingId);

    if (error) {
      console.error(`Error updating listing ${listingId}:`, error);
    } else {
      console.log(`Successfully updated listing ${listingId} with predicted price: $${predictedPrice}`);
    }
  } catch (error) {
    console.error(`Error updating listing ${listingId}:`, error);
  }
}

async function processActiveListings() {
  try {
    console.log('Fetching active listings from Supabase...');
    
    // Get all active listings that don't have a predicted price yet
    const { data: listings, error } = await supabase
      .from('bat_active_auctions')
      .select('*')
      .is('predicted_price', null);

    if (error) {
      throw error;
    }

    if (!listings || listings.length === 0) {
      console.log('No listings found that need price predictions');
      return;
    }

    console.log(`Found ${listings.length} listings to process`);

    // Process each listing
    for (const listing of listings) {
      console.log(`Processing listing ${listing.listing_id}: ${listing.year} ${listing.make} ${listing.model}`);
      
      const predictedPrice = await getPredictedPrice(listing);
      
      if (predictedPrice) {
        await updateListingWithPrediction(listing.listing_id, predictedPrice);
      }

      // Add a small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('Finished processing all listings');
  } catch (error) {
    console.error('Error processing active listings:', error);
    process.exit(1);
  }
}

// Run the script
processActiveListings().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 