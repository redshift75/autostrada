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
 * Interface for listing data including mileage, bidders, watchers, comments, transmission, and color
 */
export interface ListingData {
  mileage?: number;
  bidders?: number;
  watchers?: number;
  comments?: number;
  transmission?: 'automatic' | 'manual';
  color?: string;
}

/**
 * Fetches the listing page and extracts mileage from the BAT Essentials section
 * as well as bidders, watchers, comments counts, transmission type, and paint color
 */
export async function fetchDetailsFromListingPage(url: string): Promise<ListingData> {
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
    const result: ListingData = {};
    console.log(`Scraping Details for ${url}`);
    
    // First try to find the BAT Essentials section for mileage
    const batEssentialsRegex = /<div class="item">([\s\S]*?)<div class="item">/i;
    const essentialsMatch = html.match(batEssentialsRegex);

    if (essentialsMatch && essentialsMatch[1]) {
      const essentialsSection = essentialsMatch[1];
      
      // Look for a list item that contains "miles" or "mileage"
      const mileageItemRegex = /<li[^>]*>([\s\S]*?(?:\d+k\s*miles?|miles?|mileage)[\s\S]*?)<\/li>/gi;
      const mileageItemMatch = essentialsSection.match(mileageItemRegex);
      
      // Look for transmission type in the essentials section
      const transmissionRegex = /<li[^>]*>([\s\S]*?(?:Dual[-\s]Clutch|Double\s+Clutch|PDK|Automatic|Automated|manual|Manual|Transmission|transaxle|Sequential)[\s\S]*?)<\/li>/gi;
      const transmissionMatch = essentialsSection.match(transmissionRegex);

      // Look for paint color in the essentials section - using a more direct approach
      // Create a specific regex to find a list item that explicitly mentions paint/color
      const paintColorRegex = /<li[^>]*>([^<]*(?:Paint|Metallic|Exterior|Color|White|Black|Red|Blue|Green|Yellow|Silver|Gray|Grey)[^<]*)<\/li>/gi;
      const paintColorMatches = [];
      let paintMatch;
      
      while ((paintMatch = paintColorRegex.exec(essentialsSection)) !== null) {
        const colorText = paintMatch[1].trim();
        
        // Skip items that are likely about interior
        if (/interior|upholstery|leather|cabin|seat/.test(colorText.toLowerCase())) {
          continue;
        }
        
        // Prioritize items explicitly about paint
        if (/paint|finish|exterior color/.test(colorText.toLowerCase())) {
          paintColorMatches.unshift(colorText); // Add to front with higher priority
        } else {
          paintColorMatches.push(colorText);
        }
      }
      
      // If we found paint color matches, use the first one (highest priority)
      if (paintColorMatches.length > 0) {
        result.color = paintColorMatches[0];
      } else {
        // If we couldn't find paint directly, look for specific description in the page
        const carFinishedRegex = /(?:finished|painted) in\s+([^\.]+)/i;
        const carFinishedMatch = html.match(carFinishedRegex);
        
        if (carFinishedMatch && carFinishedMatch[1]) {
          result.color = carFinishedMatch[1].trim();
        } else {
          console.log(`No paint color found in BAT Essentials section for ${url}`);
        }
      }

      if (transmissionMatch && transmissionMatch[0]) {
        const transmissionItem = transmissionMatch[0];
        // Check for automatic transmission indicators
        if (/(?:Dual[-\s]Clutch|Double\s+Clutch|PDK|Automatic|Automated|DCT|Sequential)/gi.test(transmissionItem)) {
          result.transmission = 'automatic';
        } 
        // Check for manual transmission
        else if (/manual/i.test(transmissionItem)) {
          result.transmission = 'manual';
        }
      }
      
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
          result.mileage = parseInt(mileage);
        }
      }
    }
    
    // If we couldn't find mileage in the BAT Essentials section, try a broader search
    if (!result.mileage) {
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
        result.mileage = parseInt(mileage);
      }
    }
    
    // If transmission wasn't found in the essentials section, try a broader search
    if (!result.transmission) {
      // Look for automatic transmission indicators
      const automaticRegex = /(?:Dual[-\s]Clutch|Double\s+Clutch|PDK|Automatic|Automated|DCT|Sequential)/gi;
      const manualRegex = /\bmanual\b/gi;
      
      if (automaticRegex.test(html)) {
        result.transmission = 'automatic';
      } else if (manualRegex.test(html)) {
        result.transmission = 'manual';
      } else {
        console.log(`No transmission type found in listing page for ${url}`);
      }
    }
    
    // Extract bidders count - look for the number-bids-value in a table cell
    const biddersRegex = /<td[^>]*class="[^"]*number-bids-value[^"]*"[^>]*>([\s\S]*?)<\/td>/i;
    const biddersMatch = html.match(biddersRegex);
    if (biddersMatch && biddersMatch[1]) {
      const bidders = biddersMatch[1].trim().replace(/,/g, '');
      if (!isNaN(parseInt(bidders))) {
        result.bidders = parseInt(bidders);
      }
    }
    
    // Extract watchers count - look for data-stats-item="watchers"
    const watchersRegex = /<span[^>]*data-stats-item="watchers"[^>]*>([\s\S]*?)<\/span>/i;
    const watchersMatch = html.match(watchersRegex);
    if (watchersMatch && watchersMatch[1]) {
      // Extract the number from text like "2,870 watchers"
      const watchersText = watchersMatch[1].trim();
      const watchersNumberMatch = watchersText.match(/(\d{1,3}(?:,\d{3})*)/);
      if (watchersNumberMatch && watchersNumberMatch[1]) {
        const watchers = watchersNumberMatch[1].replace(/,/g, '');
        result.watchers = parseInt(watchers);
      }
    }
    
    // Extract comments count - look for comments-title or comments_header_html
    const commentsRegex = /<h2[^>]*class="[^"]*comments-title[^"]*"[^>]*>([\s\S]*?)<\/h2>|<span[^>]*class="[^"]*info-value[^"]*"[^>]*>(\d+)<\/span><span[^>]*class="[^"]*info-label[^"]*"[^>]*>Comments<\/span>/i;
    const commentsMatch = html.match(commentsRegex);
    if (commentsMatch) {
      let commentsText = '';
      if (commentsMatch[1]) {
        commentsText = commentsMatch[1].trim();
      } else if (commentsMatch[2]) {
        commentsText = commentsMatch[2].trim();
      }
      
      // Extract the number from text like "106 Comments"
      const commentsNumberMatch = commentsText.match(/(\d+)/);
      if (commentsNumberMatch && commentsNumberMatch[1]) {
        result.comments = parseInt(commentsNumberMatch[1]);
      }
    }
    return result;
  } catch (error) {
    console.error(`Error fetching data from listing page ${url}:`, error);
    return {};
  }
}