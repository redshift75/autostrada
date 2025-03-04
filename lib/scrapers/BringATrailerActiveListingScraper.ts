import { BaseScraper } from './BaseScraper';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { extractMileageFromTitle, fetchDetailsFromListingPage } from '../utils/BATDetailsExtractor';

// Define our own BaTListing interface
export interface BaTActiveListing {
  id: number;
  url: string;
  title: string;
  year: string;
  make: string;
  model: string;
  current_bid: number;
  current_bid_formatted: string;
  endDate: number;
  image_url: string;
  image_url_thumb: string;
  location: string;
  seller_username?: string;
  seller_id?: string;
  sold_price?: number;
  reserve_met?: boolean;
  reserve_not_met?: boolean;
  no_reserve?: boolean;
  premium?: boolean;
  featured?: boolean;
  status?: string;
  mileage?: number; // Vehicle mileage if available, extracted from title or listing page
  bidders?: number; // Number of bidders on the listing
  watchers?: number; // Number of users watching the listing
  comments?: number; // Number of comments on the listing
}

// Interface for auction data from the website
export interface BaTAuction {
  id: number;
  url: string;
  title: string;
  year: string;
  current_bid: number;
  current_bid_formatted: string;
  timestamp_end: number;
  thumbnail_url: string;
  country: string;
  noreserve: boolean;
  premium: boolean;
  active: boolean;
}

// Interface for the full auctions data object
interface BaTAuctionsData {
  auctions: BaTAuction[];
}

// Interface for scraper parameters
export interface BaTActiveScraperParams {
  make?: string;
  model?: string;
  yearMin?: number;
  yearMax?: number;
}

export class BringATrailerActiveListingScraper extends BaseScraper {
  private baseUrl = 'https://bringatrailer.com';
  private searchUrl = 'https://bringatrailer.com/auctions/';
  private static debuggedAuction = false;

  constructor() {
    super({
      requestsPerMinute: 10,
      minRequestInterval: 3000,
      cacheEnabled: true,
      cacheTTL: 3600000 // 1 hour
    });
  }

  /**
   * Fetches HTML content from a URL with caching
   * @param url The URL to fetch
   * @returns The HTML content as a string
   */
  private async fetchHtml(url: string): Promise<string> {
    try {
      // Use the fetch method from BaseScraper which handles caching and rate limiting
      const response = await this.fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      // Get the HTML text from the response
      const html = await response.text();
      return html;
    } catch (error) {
      console.error(`Error fetching HTML from ${url}:`, error);
      throw error;
    }
  }

  async scrape(): Promise<BaTActiveListing[]> {
    try {
      console.log(`Fetching recent listings from ${this.searchUrl}`);
      const html = await this.fetchHtml(this.searchUrl);
      
      // Save HTML for debugging only in development environment
      if (process.env.NODE_ENV === 'development') {
        try {
          const debugDir = path.join(process.cwd(), 'debug');
          if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir, { recursive: true });
          }
          const debugFile = path.join(debugDir, `bat_debug_${Date.now()}.html`);
          fs.writeFileSync(debugFile, html);
          console.log(`Saved debug HTML to ${debugFile}`);
        } catch (error) {
          console.error('Error saving debug HTML:', error);
          // Continue execution even if debug file saving fails
        }
      }
      
      console.log('Extracting auction data from HTML...');
      const auctionsData = await this.extractAuctionsData(html);
      
      if (!auctionsData || !auctionsData.auctions || auctionsData.auctions.length === 0) {
        console.log('No auction data found in the HTML');
        // Try to extract some sample HTML to understand the structure
        const sampleHtml = html.substring(0, 1000) + '...\n...\n' + html.substring(html.length - 1000);
        console.log('Sample HTML:', sampleHtml);
        return [];
      }
      
      console.log(`Found ${auctionsData.auctions.length} auctions in the HTML`);
      
      // Log a sample auction for debugging
      if (auctionsData.auctions.length > 0) {
        console.log('Sample auction data:', JSON.stringify(auctionsData.auctions[0], null, 2));
      }
      
      const listings: BaTActiveListing[] = auctionsData.auctions.map(auction => 
        this.convertAuctionToBaTListing(auction)
      );
      
      // Log a sample listing for debugging
      if (listings.length > 0) {
        console.log('Sample converted listing:', JSON.stringify(listings[0], null, 2));
      }
      
      // Save listings to file for debugging only in development environment
      if (process.env.NODE_ENV === 'development') {
        try {
          const debugDir = path.join(process.cwd(), 'debug');
          if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir, { recursive: true });
          }
          const listingsFile = path.join(debugDir, `bat_active_listings_${Date.now()}.json`);
          fs.writeFileSync(listingsFile, JSON.stringify(listings, null, 2));
          console.log(`Saved ${listings.length} listings to ${listingsFile}`);
        } catch (error) {
          console.error('Error saving debug file:', error);
          // Continue execution even if debug file saving fails
        }
      }
      
      return listings;
    } catch (error) {
      console.error('Error scraping BaT:', error);
      return [];
    }
  }

  async searchListings(params: BaTActiveScraperParams): Promise<BaTActiveListing[]> {
    try {
      // First, fetch all active listings
      console.log('Fetching all active listings first...');
      const allListings = await this.scrape();
      
      if (allListings.length === 0) {
        console.log('No active listings found');
        return [];
      }
      
      console.log(`Found ${allListings.length} active listings, now filtering...`);
      
      // Filter the listings based on parameters
      let filteredListings = allListings;
      
      // Filter by make if provided
      if (params.make) {
        const makeLower = params.make.toLowerCase();
        console.log(`Filtering by make: ${params.make}`);
        
        filteredListings = this.filterListingsByMake(filteredListings, makeLower);
        console.log(`After make filtering: ${filteredListings.length} listings`);
      }
      
      // Filter by model if provided
      if (params.model) {
        const modelLower = params.model.toLowerCase();
        console.log(`Filtering by model: ${params.model}`);
        
        filteredListings = filteredListings.filter(listing => {
          // Check if the extracted model matches the requested model
          const modelMatches = listing.model.toLowerCase() === modelLower ||
                              listing.model.toLowerCase().includes(modelLower) ||
                              modelLower.includes(listing.model.toLowerCase());
                              
          // Also check if model appears in title as a fallback
          const titleContainsModel = listing.title.toLowerCase().includes(modelLower);
          
          return modelMatches || titleContainsModel;
        });
        console.log(`After model filtering: ${filteredListings.length} listings`);
      }
      
      // Filter by year range if provided
      if (params.yearMin || params.yearMax) {
        filteredListings = filteredListings.filter(listing => {
          const year = parseInt(listing.year);
          if (isNaN(year)) return false;
          
          if (params.yearMin && year < params.yearMin) return false;
          if (params.yearMax && year > params.yearMax) return false;
          
          return true;
        });
        console.log(`After year filtering: ${filteredListings.length} listings`);
      }
      
      console.log(`Filtered to ${filteredListings.length} listings`);
      
      // Log the makes and mileage of the first 10 listings to verify filtering
      if (filteredListings.length > 0) {
        console.log("Sample of filtered listings:");
        filteredListings.slice(0, Math.min(10, filteredListings.length)).forEach(listing => {
          const mileageInfo = listing.mileage ? `${listing.mileage} miles` : 'unknown mileage';
          console.log(`- ${listing.title} (${listing.make}, ${mileageInfo})`);
        });
      }
      
      return filteredListings;
    } catch (error) {
      console.error('Error searching BaT listings:', error);
      return [];
    }
  }
  
  /**
   * Filter listings by make
   * @param listings The listings to filter
   * @param makeLower The make to filter by (lowercase)
   * @returns Filtered listings
   */
  private filterListingsByMake(listings: BaTActiveListing[], makeLower: string): BaTActiveListing[] {
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

  private async extractAuctionsData(html: string): Promise<BaTAuctionsData | null> {
    try {
      // The auction data appears to be directly embedded in the HTML as a JSON array
      // Look for patterns that indicate the start of auction data
      const auctionObjects = this.extractJsonArrayFromHtml(html);
      
      if (auctionObjects && auctionObjects.length > 0) {
        return { auctions: auctionObjects };
      }
      
      // If we couldn't find the data using regex, try parsing the HTML
      console.log('Could not find auction data using regex, trying HTML parsing');
      return this.extractAuctionsDataFromHtml(html);
    } catch (error) {
      console.error('Error extracting auctions data:', error);
      return null;
    }
  }
  
  private extractJsonArrayFromHtml(html: string): BaTAuction[] | null {
    try {
      console.log('Attempting to extract JSON auction data from HTML...');
      
      // First, check if we can find the auctions data in a script tag
      const scriptRegex = /<script[^>]*>window\.__INITIAL_STATE__\s*=\s*({.*?})<\/script>/;
      const scriptMatch = html.match(scriptRegex);
      
      if (scriptMatch && scriptMatch[1]) {
        console.log('Found potential initial state data in script tag');
        try {
          const initialState = JSON.parse(scriptMatch[1]);
          if (initialState && initialState.auctions && Array.isArray(initialState.auctions.auctions)) {
            console.log(`Found ${initialState.auctions.auctions.length} auctions in initial state`);
            return initialState.auctions.auctions;
          }
        } catch (e) {
          console.error('Error parsing initial state JSON:', e);
        }
      }
      
      // Look for JSON objects that match the auction structure
      console.log('Trying regex pattern to find auction data...');
      const regex = /"active":true,"categories":\[.*?\],"comments":.*?"id":\d+/g;
      let matches = html.match(regex);
      
      if (!matches || matches.length === 0) {
        console.log('No auction data matches found with primary regex pattern');
        
        // Try an alternative pattern
        const altRegex = /"id":\d+,"title":"[^"]+","year":"[^"]+"/g;
        const altMatches = html.match(altRegex);
        
        if (!altMatches || altMatches.length === 0) {
          console.log('No auction data matches found with alternative regex pattern');
          
          // Check if the HTML contains any auction-like data
          const hasAuctionData = html.includes('"auctions"') || html.includes('"listings"');
          console.log(`HTML contains auction-like data: ${hasAuctionData}`);
          
          return null;
        }
        
        console.log(`Found ${altMatches.length} potential auction objects with alternative pattern`);
        matches = altMatches;
      } else {
        console.log(`Found ${matches.length} potential auction objects with primary pattern`);
      }
      
      // For each match, try to extract the complete JSON object
      const auctions: BaTAuction[] = [];
      
      for (const match of matches) {
        try {
          // Find the start of the object
          const startIndex = html.indexOf('{', html.indexOf(match));
          if (startIndex === -1) continue;
          
          // Find the end of the object
          let bracketCount = 1;
          let endIndex = startIndex + 1;
          
          while (bracketCount > 0 && endIndex < html.length) {
            if (html[endIndex] === '{') bracketCount++;
            else if (html[endIndex] === '}') bracketCount--;
            endIndex++;
          }
          
          if (bracketCount !== 0) continue;
          
          const jsonStr = html.substring(startIndex, endIndex);
          
          // Log a sample of the extracted JSON
          if (auctions.length === 0) {
            console.log(`Sample JSON string (first 200 chars): ${jsonStr.substring(0, 200)}...`);
          }
          
          const auction = JSON.parse(jsonStr) as BaTAuction;
          
          // Verify this is an auction object
          if (auction && auction.id && auction.url && auction.title) {
            auctions.push(auction);
          }
        } catch (error) {
          // Continue to the next match if there's an error
          console.error('Error parsing potential auction object:', error);
        }
      }
      
      console.log(`Successfully extracted ${auctions.length} auction objects`);
      return auctions.length > 0 ? auctions : null;
    } catch (error) {
      console.error('Error extracting JSON array from HTML:', error);
      return null;
    }
  }

  private async extractAuctionsDataFromHtml(html: string): Promise<BaTAuctionsData | null> {
    try {
      const $ = cheerio.load(html);
      const auctions: BaTAuction[] = [];
      
      // Find auction listings in the HTML
      $('.auction-item').each((_, element) => {
        try {
          const $el = $(element);
          
          const id = parseInt($el.attr('data-id') || '0');
          const url = $el.find('a.auction-title').attr('href') || '';
          const title = $el.find('a.auction-title').text().trim();
          const year = $el.find('.auction-year').text().trim();
          
          // Improved bid extraction
          const currentBidText = $el.find('.auction-price').text().trim();
          const currentBid = this.parseBidAmount(currentBidText);
          
          const thumbnailUrl = $el.find('img').attr('src') || '';
          const country = $el.find('.auction-location').text().trim();
          
          // Extract timestamp from data attribute or other source
          const timestampEnd = parseInt($el.attr('data-end-time') || '0');
          
          // Determine if no reserve
          const noReserve = $el.find('.no-reserve-label').length > 0;
          
          // Determine if premium
          const premium = $el.hasClass('premium-listing');
          
          // Determine if active
          const active = !$el.hasClass('ended');
          
          if (id && url && title) {
            auctions.push({
              id,
              url,
              title,
              year,
              current_bid: currentBid,
              current_bid_formatted: currentBidText || `USD $${currentBid.toLocaleString()}`,
              timestamp_end: timestampEnd,
              thumbnail_url: thumbnailUrl,
              country,
              noreserve: noReserve,
              premium,
              active
            });
          }
        } catch (e) {
          console.error('Error parsing auction element:', e);
        }
      });
      
      if (auctions.length > 0) {
        console.log(`Extracted ${auctions.length} auctions from HTML`);
        return { auctions };
      }
      
      console.log('No auctions found in HTML');
      return null;
    } catch (error) {
      console.error('Error extracting auctions from HTML:', error);
      return null;
    }
  }

  /**
   * Parse a bid amount from a string
   * @param bidText The bid text to parse
   * @returns The bid amount as a number
   */
  private parseBidAmount(bidText: string): number {
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

  private convertAuctionToBaTListing(auction: BaTAuction): BaTActiveListing {
    // Extract location from country
    const location = auction.country || '';
    
    // Convert timestamp to Date
    const endDate = auction.timestamp_end * 1000; // Convert to milliseconds
    
    // Debug logging for timestamp conversion (only for the first auction)
    if (auction.id && !BringATrailerActiveListingScraper.debuggedAuction) {
      console.log(`Debug timestamp for auction ${auction.id}:`);
      console.log(`- Title: ${auction.title}`);
      console.log(`- Raw timestamp_end: ${auction.timestamp_end}`);
      console.log(`- Converted to milliseconds: ${endDate}`);
      console.log(`- As Date object: ${new Date(endDate).toISOString()}`);
      BringATrailerActiveListingScraper.debuggedAuction = true;
    }
    
    // Check if the auction has ended
    const now = Date.now();
    const isEnded = endDate < now;
    
    // Determine if the auction has a sold price
    let soldPrice = 0;
    if (isEnded && auction.current_bid > 0) {
      soldPrice = auction.current_bid;
    }
    
    // Extract make and model
    const make = this.extractMakeFromTitle(auction.title);
    const model = this.extractModelFromTitle(auction.title, make);
    
    // Extract mileage from title
    let mileage = undefined;
    if (auction.title) {
      mileage = extractMileageFromTitle(auction.title);
    }
    
    // Create the listing object
    const listing: BaTActiveListing = {
      id: auction.id,
      url: auction.url,
      title: auction.title,
      year: auction.year,
      make,
      model,
      current_bid: auction.current_bid,
      current_bid_formatted: auction.current_bid_formatted,
      endDate,
      image_url: auction.thumbnail_url,
      image_url_thumb: auction.thumbnail_url,
      location,
      no_reserve: auction.noreserve,
      premium: auction.premium,
      status: isEnded ? 'ended' : 'active',
      sold_price: soldPrice > 0 ? soldPrice : undefined,
      mileage
    };
    
    // If mileage not found in title, fetch it asynchronously from the listing page
    // We'll do this in the background and not wait for it to complete
    if (!mileage && auction.url) {
      this.fetchAndUpdateDetails(listing);
    }
    
    return listing;
  }
  
  /**
   * Fetches details from the listing page and updates the listing object
   * This is done asynchronously to avoid blocking the main flow
   */
  private async fetchAndUpdateDetails(listing: BaTActiveListing): Promise<void> {
    try {
      console.log(`Fetching details for ${listing.title} from ${listing.url}`);
      const listingData = await fetchDetailsFromListingPage(listing.url);
      
      if (listingData.mileage) {
        console.log(`Updated mileage for ${listing.title}: ${listingData.mileage}`);
        listing.mileage = listingData.mileage;
      }
      
      if (listingData.bidders) {
        console.log(`Updated bidders for ${listing.title}: ${listingData.bidders}`);
        listing.bidders = listingData.bidders;
      }
      
      if (listingData.watchers) {
        console.log(`Updated watchers for ${listing.title}: ${listingData.watchers}`);
        listing.watchers = listingData.watchers;
      }
      
      if (listingData.comments) {
        console.log(`Updated comments for ${listing.title}: ${listingData.comments}`);
        listing.comments = listingData.comments;
      }
    } catch (error) {
      console.error(`Error fetching details for ${listing.title}:`, error);
    }
  }
  
  private extractMakeFromTitle(title: string): string {
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
  
  private extractModelFromTitle(title: string, make: string): string {
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
    
    return '';
  }
} 