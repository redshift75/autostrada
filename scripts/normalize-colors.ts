import OpenAI from 'openai';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
const maxBatchesArg = args.find(arg => arg.startsWith('--batches='));
const maxBatches = maxBatchesArg ? parseInt(maxBatchesArg.split('=')[1]) : Infinity;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Standard list of car colors (expanded)
const STANDARD_CAR_COLORS = [
  // Original colors
  'Black',
  'White',
  'Silver',
  'Gray',
  'Red',
  'Blue',
  'Green',
  'Ivory',
  'Yellow',
  'Brown',
  'Orange',
  'Purple',
  'Gold',
  'Beige',
  'Champagne',
  'Burgundy',
  'Navy',
  'Tan',
  'Bronze',
  'Copper',
  'Maroon',
  'Ruby',
  'Platinum',
  'Magenta',
  'Pink'
];

// Ensure the results directory exists
const resultsDir = './color_normalization_results';
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir);
}

/**
 * Normalizes car colors to the standard list
 * @param colorData Array of objects with listingid and exterior_color
 * @returns Promise with normalized color data
 */
async function normalizeCarColors(colorData: Array<{listing_id: string, exterior_color: string}>): Promise<Array<{listing_id: string, exterior_color: string, normalized_color: string}>> {
  try {
    // Prepare the data for the API request
    const carsToNormalize = colorData.map(item => ({
      listing_id: item.listing_id,
      exterior_color: item.exterior_color
    }));
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `You are a car color normalization assistant. Your task is to map non-standard car colors to the closest match in this standard list: ${STANDARD_CAR_COLORS.join(', ')}. 
          For each car in the input array, add a 'normalized_color' property with the matching standard color.
          Respond ONLY with a valid JSON array of objects called cars, each containing 'listing_id', 'exterior_color', and 'normalized_color'.`
        },
        {
          role: "user",
          content: `Normalize these cars to the standard list of colors: ${JSON.stringify(carsToNormalize)}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const normalizedResponse = JSON.parse(response.choices[0].message.content || '{}');
    
    // Return the normalized data, ensuring it has the expected format
    if (Array.isArray(normalizedResponse.cars)) {
      return normalizedResponse.cars;
    } else {
      console.error('Invalid response format from OpenAI');
      return [];
    }


  } catch (error) {
    console.error('Error normalizing colors:', error);
    throw error;
  }
}

/**
 * Fetches car data from Supabase in batches and normalizes colors
 */
async function processCarColors() {
  const batchSize = 50;
  let startIndex = 0;
  let hasMoreData = true;
  let allResults: Array<{listing_id: string, exterior_color: string, normalized_color: string}> = [];
  let batchCount = 0;
  
  console.log(`Starting to process up to ${maxBatches === Infinity ? 'all' : maxBatches} batches of car colors from Supabase...`);
  
  while (hasMoreData && batchCount < maxBatches) {
    try {
      // Fetch a batch of car data
      const { data, error } = await supabase
        .from('bat_completed_auctions')
        .select('listing_id, exterior_color')
        .range(startIndex, startIndex + batchSize - 1)
        .neq('exterior_color', null)
        .is('normalized_color', null)
        .order('listing_id');
      
      if (error) {
        console.error('Supabase query error:', error);
        break;
      }
      
      if (!data || data.length === 0) {
        hasMoreData = false;
        console.log('No more data to process.');
        break;
      }
      
      batchCount++;
      console.log(`Processing batch ${batchCount} of ${data.length} records (starting from index ${startIndex})...`);

      if (data.length > 0) {
        // Normalize the colors for this batch
        const normalizedBatch = await normalizeCarColors(data);
        allResults = [...allResults, ...normalizedBatch];
        
        console.log(`Processed ${normalizedBatch.length} valid colors in batch ${batchCount}.`);
        
        // Save batch results to a file
        const batchFileName = path.join(resultsDir, `batch_${batchCount}_normalized_colors.json`);
        fs.writeFileSync(
          batchFileName, 
          JSON.stringify(normalizedBatch, null, 2)
        );
        console.log(`Saved batch ${batchCount} results to ${batchFileName}`);
      } else {
        console.log('No valid colors found in this batch.');
      }
      
      // Move to the next batch
      startIndex += batchSize;
      
      // If we got fewer records than the batch size, we've reached the end
      if (data.length < batchSize) {
        hasMoreData = false;
        console.log('Reached the end of the data.');
      }
      
      // Optional: Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`Error processing batch ${batchCount}:`, error);
      
      // Save what we have so far even after an error
      const errorBatchFileName = path.join(resultsDir, `batch_${batchCount}_error_partial.json`);
      fs.writeFileSync(
        errorBatchFileName, 
        JSON.stringify(allResults, null, 2)
      );
      console.log(`Saved partial results after error to ${errorBatchFileName}`);
      
      break;
    }
  }
  
  // Save all accumulated results to a file
  if (allResults.length > 0) {
    const allResultsFileName = path.join(resultsDir, 'all_normalized_colors.json');
    fs.writeFileSync(
      allResultsFileName, 
      JSON.stringify(allResults, null, 2)
    );
    console.log(`Successfully processed ${allResults.length} car colors across ${batchCount} batches.`);
    console.log(`Complete results saved to ${allResultsFileName}`);
  } else {
    console.log('No colors were processed.');
  }
  
  return allResults;
}

/**
 * Main function to run the script
 */
async function main() {
  try {
    console.log('Starting car color normalization process...');
    console.log(`Will process ${maxBatches === Infinity ? 'all available' : maxBatches} batches`);
    const results = await processCarColors();
    console.log(`Completed with ${results.length} normalized color entries.`);
  } catch (error) {
    console.error('Failed to complete the normalization process:', error);
  }
}

// Run the script
main(); 