import axios from 'axios';

/**
 * Common utility functions for BaT scrapers
 */

/**
 * Parse a bid amount from a string
 * @param bidText The bid text to parse
 * @returns The bid amount as a number
 */
export function parseBidAmount(bidText: string): number {
  if (!bidText) return 0;
  
  // Check for "No Reserve" or other non-price text
  if (/no reserve|reserve not met|bid|comment|watching/i.test(bidText) && !/\d/.test(bidText)) {
    return 0;
  }
  
  // Handle "Bid to" or other prefixes
  const cleanText = bidText.replace(/^(Bid to|Current Bid:|Price:|Sold for:)\s*/i, '');
  
  // Remove currency symbols and commas
  const numericText = cleanText.replace(/[$,€£¥]/g, '');
  
  // Parse the number
  const amount = parseInt(numericText.trim());
  return isNaN(amount) ? 0 : amount;
}

/**
 * Extract make from a vehicle title
 * @param title The vehicle title
 * @returns The extracted make
 */
export function extractMakeFromTitle(title: string): string {
  // Common car makes to look for in the title
  const commonMakes = [
    'Porsche', 'Ferrari', 'Mercedes-Benz', 'Mercedes', 'BMW', 'Audi', 'Volkswagen', 'VW',
    'Toyota', 'Honda', 'Nissan', 'Mazda', 'Subaru', 'Lexus', 'Acura', 'Infiniti',
    'Ford', 'Chevrolet', 'Chevy', 'Dodge', 'Jeep', 'Cadillac', 'Lincoln', 'Buick',
    'Jaguar', 'Land Rover', 'Range Rover', 'Aston Martin', 'Bentley', 'Rolls-Royce',
    'Lamborghini', 'Maserati', 'Alfa Romeo', 'Fiat', 'Lancia', 'Bugatti'
  ];
  
  // Convert title to lowercase for case-insensitive matching
  const titleLower = title.toLowerCase();
  
  // Check if any of the common makes are in the title (case-insensitive)
  for (const make of commonMakes) {
    if (titleLower.includes(make.toLowerCase())) {
      return make; // Return the properly capitalized make
    }
  }
  
  // If no common make is found, try to extract the make from the year pattern
  // e.g., "1995 Porsche 911" -> "Porsche"
  const yearMakePattern = /\d{4}\s+([A-Za-z-]+)/;
  const match = title.match(yearMakePattern);
  
  if (match && match[1]) {
    // Check if the extracted make is one of our common makes
    const extractedMake = match[1];
    const matchedCommonMake = commonMakes.find(make => 
      make.toLowerCase() === extractedMake.toLowerCase()
    );
    
    return matchedCommonMake || extractedMake;
  }
  
  return '';
}

/**
 * Extract model from a vehicle title
 * @param title The vehicle title
 * @param make The vehicle make
 * @returns The extracted model
 */
export function extractModelFromTitle(title: string, make: string): string {
  if (!make) return '';
  
  // Try to extract the model after the make
  const modelPattern = new RegExp(`${make}\\s+([A-Za-z0-9-]+)`, 'i'); // Case-insensitive
  const match = title.match(modelPattern);
  
  if (match && match[1]) {
    return match[1];
  }
  
  // If no model found after make, try to find common model patterns
  // For BMW, look for M followed by a number
  if (make.toLowerCase() === 'bmw') {
    const bmwModelPattern = /\bM[1-8](?:\s|$|\b)/i;
    const bmwMatch = title.match(bmwModelPattern);
    if (bmwMatch) {
      return bmwMatch[0].trim();
    }
  }
  
  // For Porsche, handle common models with special logic
  if (make === 'Porsche') {
    const parts = title.split(/\s+/);
    const modelIndex = parts.findIndex(part => 
      part === '911' || part === '356' || part === '944' || 
      part === '928' || part === '968' || part === '914' || 
      part === '718' || part === 'Cayenne' || part === 'Macan' || 
      part === 'Panamera' || part === 'Cayman' || part === 'Boxster' || 
      part === 'Taycan'
    );
    
    if (modelIndex !== -1) {
      const model = parts[modelIndex];
      
      // For 911, often include the variant (Carrera, Turbo, etc.)
      if (model === '911' && parts.length > modelIndex + 1) {
        if (['Carrera', 'Turbo', 'GT3', 'GT2', 'Targa'].includes(parts[modelIndex + 1])) {
          // Include the variant in the model
          let fullModel = model + ' ' + parts[modelIndex + 1];
          
          // Sometimes there's more specificity (Carrera 4, Turbo S, etc.)
          if (parts.length > modelIndex + 2 && ['4', 'S', 'RS', '4S'].includes(parts[modelIndex + 2])) {
            fullModel += ' ' + parts[modelIndex + 2];
          }
          
          return fullModel;
        }
      }
      
      return model;
    }
  }
  
  return '';
}

/**
 * Parse a vehicle title to extract year, make, and model
 * @param title The vehicle title
 * @param make Default make to use if not found in title
 * @param modelSuggestions Optional list of model suggestions for the specified make
 * @returns Object containing year, make, and model
 */
export function parseTitle(title: string, make: string = '', modelSuggestions: string[] = []): { year?: number; make?: string; model?: string } {
  // Look for a 4-digit year anywhere in the title
  const yearMatch = title.match(/\b(19\d{2}|20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;
  
  // If no year found, return early
  if (!year) {
    return { year: undefined, make: undefined, model: undefined };
  }
  
  // Extract make if not provided
  const extractedMake = make || extractMakeFromTitle(title);
  
  // Look for the make in the title
  if (extractedMake) {
    // Extract the text after the make
    const makeIndex = title.toLowerCase().indexOf(extractedMake.toLowerCase());
    let afterMake = '';
    
    if (makeIndex !== -1) {
      afterMake = title.substring(makeIndex + extractedMake.length).trim();
    }
    
    // If we have model suggestions, try to find the best match
    if (modelSuggestions.length > 0) {
      // Sort model suggestions by length (descending) to prioritize longer matches
      const sortedSuggestions = [...modelSuggestions].sort((a, b) => b.length - a.length);
      
      // Try to find a model suggestion in the text after the make
      for (const modelSuggestion of sortedSuggestions) {
        if (afterMake.includes(modelSuggestion) || modelSuggestion.includes(afterMake)) {
          return { year, make: extractedMake, model: modelSuggestion };
        } 
      }
    }
    
    // If no model suggestions matched, use the standard extraction
    const model = extractModelFromTitle(title, extractedMake);
    return { year, make: extractedMake, model };
  }
  
  // If we couldn't find the make in the title, just return the year
  return { year, make: undefined, model: undefined };
}

/**
 * Filter listings by make
 * @param listings The listings to filter
 * @param makeLower The make to filter by (lowercase)
 * @returns Filtered listings
 */
export function filterListingsByMake<T extends { make: string; title: string }>(listings: T[], makeLower: string): T[] {
  // First try exact match on make field
  const exactMatches = listings.filter(listing => 
    listing.make.toLowerCase() === makeLower
  );
  
  if (exactMatches.length > 0) {
    console.log(`Found ${exactMatches.length} exact make matches for "${makeLower}"`);
    return exactMatches;
  }
  
  // If no exact matches, try partial matches
  const partialMatches = listings.filter(listing => {
    // Check if the extracted make contains or is contained by the requested make
    const makeMatches = listing.make.toLowerCase().includes(makeLower) ||
                       makeLower.includes(listing.make.toLowerCase());
                       
    // Also check if make appears in title as a fallback
    const titleContainsMake = listing.title.toLowerCase().includes(makeLower);
    
    return makeMatches || titleContainsMake;
  });
  
  console.log(`Found ${partialMatches.length} partial make matches for "${makeLower}"`);
  return partialMatches;
}

/**
 * Filter listings by model
 * @param listings The listings to filter
 * @param modelLower The model to filter by (lowercase)
 * @returns Filtered listings
 */
export function filterListingsByModel<T extends { model: string; title: string }>(listings: T[], modelLower: string): T[] {
  return listings.filter(listing => {
    // Check if the extracted model matches the requested model
    const modelMatches = listing.model.toLowerCase() === modelLower ||
                        listing.model.toLowerCase().includes(modelLower) ||
                        modelLower.includes(listing.model.toLowerCase());
                        
    // Also check if model appears in title as a fallback
    const titleContainsModel = listing.title.toLowerCase().includes(modelLower);
    
    return modelMatches || titleContainsModel;
  });
}

/**
 * Filter listings by year range
 * @param listings The listings to filter
 * @param yearMin Minimum year (inclusive)
 * @param yearMax Maximum year (inclusive)
 * @returns Filtered listings
 */
export function filterListingsByYear<T extends { year: string | number }>(listings: T[], yearMin?: number, yearMax?: number): T[] {
  return listings.filter(listing => {
    const year = typeof listing.year === 'string' ? parseInt(listing.year) : listing.year;
    if (isNaN(year)) return false;
    
    if (yearMin && year < yearMin) return false;
    if (yearMax && year > yearMax) return false;
    
    return true;
  });
} 