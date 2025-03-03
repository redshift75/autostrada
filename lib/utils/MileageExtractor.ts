import axios from 'axios';

/**
 * Extracts mileage from the title if available
 * Examples: "9k-Mile 2008 Ferrari 612 Scaglietti", "4,400-Mile 1988 Ferrari Testarossa", "43K-Mile 1988 Audi 90 Quattro 5-Speed"
 */
export function extractMileageFromTitle(title: string): number | undefined {
  // Match patterns like "9k-Mile", "4,400-Mile", "43K-Mile"
  const mileageRegex = /(\d{1,3}(?:,\d{3})*|\d+k)[-\s]?mile/i;
  const match = title.match(mileageRegex);
  
  if (match) {
    let mileage = match[1];
    
    // Convert "k" or "K" notation to full number
    if (mileage.toLowerCase().endsWith('k')) {
      mileage = mileage.toLowerCase().replace('k', '000');
    }
    
    // Remove commas
    mileage = mileage.replace(/,/g, '');
    
    return parseInt(mileage);
  }
  
  return undefined;
}

/**
 * Fetches the listing page and extracts mileage from the BAT Essentials section
 */
export async function fetchMileageFromListingPage(url: string): Promise<number | undefined> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive'
      }
    });
    
    const html = response.data;
    
    // First try to find the BAT Essentials section
    const batEssentialsRegex = /<div[^>]*class="[^"]*bat-essentials[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
    const essentialsMatch = html.match(batEssentialsRegex);
    
    if (essentialsMatch && essentialsMatch[1]) {
      const essentialsSection = essentialsMatch[1];
      
      // Look for a list item that contains "miles" or "mileage"
      const mileageItemRegex = /<li[^>]*>([\s\S]*?(?:miles?|mileage)[\s\S]*?)<\/li>/i;
      const mileageItemMatch = essentialsSection.match(mileageItemRegex);
      
      if (mileageItemMatch && mileageItemMatch[1]) {
        const mileageItem = mileageItemMatch[1];
        
        // Extract the numeric part (with possible commas or 'k' suffix)
        const mileageValueRegex = /(\d{1,3}(?:,\d{3})*|\d+k)\s*miles?/i;
        const mileageValueMatch = mileageItem.match(mileageValueRegex);
        
        if (mileageValueMatch && mileageValueMatch[1]) {
          let mileage = mileageValueMatch[1];
          
          // Convert "k" notation to full number
          if (mileage.toLowerCase().endsWith('k')) {
            mileage = mileage.toLowerCase().replace('k', '000');
          }
          
          // Remove commas
          mileage = mileage.replace(/,/g, '');
          
          console.log(`Found mileage from ${url}: ${mileage}`);
          return parseInt(mileage);
        }
      }
    }
    
    // If we couldn't find mileage in the BAT Essentials section, try a broader search
    // Look for any mention of mileage in the page content
    const contentMileageRegex = /(?:(?:indicated|showing|shows|documented|actual|original|current|chassis|odometer|reads?)\s+)?(\d{1,3}(?:,\d{3})*|\d+k)\s*miles?/i;
    const contentMileageMatch = html.match(contentMileageRegex);
    
    if (contentMileageMatch && contentMileageMatch[1]) {
      let mileage = contentMileageMatch[1];
      
      // Convert "k" notation to full number
      if (mileage.toLowerCase().endsWith('k')) {
        mileage = mileage.toLowerCase().replace('k', '000');
      }
      
      // Remove commas
      mileage = mileage.replace(/,/g, '');
      
      console.log(`Found mileage from ${url}: ${mileage}`);
      return parseInt(mileage);
    }
    
    console.log(`No mileage found in listing page: ${url}`);
    return undefined;
  } catch (error) {
    console.error(`Error fetching mileage from listing page ${url}:`, error);
    return undefined;
  }
} 