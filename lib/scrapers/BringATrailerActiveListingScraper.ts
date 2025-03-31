import { BaseBATScraper } from './BaseBATScraper';
import * as cheerio from 'cheerio';
import { 
  parseBidAmount, 
  extractMakeFromTitle, 
  extractModelFromTitle,
  filterListingsByMake,
  filterListingsByModel,
  filterListingsByYear
} from './BaTScraperUtils';
import { fetchDetailsFromListingPage } from './BATDetailsExtractor';

// Define our own BaTListing interface
export interface BaTActiveListing {
  listing_id: number;
  url: string;
  title: string;
  year: number;
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
  transmission?: 'automatic' | 'manual'; // Transmission type
  color?: string; // Vehicle color
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
  scrapeDetails?: boolean;
}

export class BringATrailerActiveListingScraper extends BaseBATScraper {
  private baseUrl = 'https://bringatrailer.com';
  private searchUrl = 'https://bringatrailer.com/auctions/';
  private scrapeDetails: boolean;

  constructor(params: BaTActiveScraperParams = {}) {
    super({
      requestsPerMinute: 10,
      minRequestInterval: 3000,
    });
    this.scrapeDetails = params.scrapeDetails ?? true;
  }

  async scrape(): Promise<BaTActiveListing[]> {
    try {
      console.log(`Fetching recent listings from ${this.searchUrl}`);
      const html = await this.fetchHtml(this.searchUrl);
      
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
      
      // Convert auctions to listings with additional details
      const listingsPromises = auctionsData.auctions.map(auction => 
        this.convertAuctionToBaTListing(auction)
      );
      
      const listings = await Promise.all(listingsPromises);
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
        
        filteredListings = filterListingsByMake(filteredListings, makeLower);
        console.log(`After make filtering: ${filteredListings.length} listings`);
      }
      
      // Filter by model if provided
      if (params.model) {
        const modelLower = params.model.toLowerCase();
        console.log(`Filtering by model: ${params.model}`);
        
        filteredListings = filterListingsByModel(filteredListings, modelLower);
        console.log(`After model filtering: ${filteredListings.length} listings`);
      }
      
      // Filter by year range if provided
      if (params.yearMin || params.yearMax) {
        filteredListings = filterListingsByYear(filteredListings, params.yearMin, params.yearMax);
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
          const currentBid = currentBidText ? parseBidAmount(currentBidText) : 0;
          
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

  private async convertAuctionToBaTListing(auction: BaTAuction): Promise<BaTActiveListing> {
    // Extract location from country
    const location = auction.country || '';
    
    // Convert timestamp to Date
    const endDate = auction.timestamp_end * 1000; // Convert to milliseconds
    
    // Check if the auction has ended
    const now = Date.now();
    const isEnded = endDate < now;
    
    // Determine if the auction has a sold price
    let soldPrice = 0;
    if (isEnded && auction.current_bid > 0) {
      soldPrice = auction.current_bid;
    }
    
    // Extract make and model using shared utility functions
    const make = extractMakeFromTitle(auction.title);
    const model = extractModelFromTitle(auction.title, make);
    
    // Parse year as integer
    const year = parseInt(auction.year, 10);
    
    // Create the base listing object
    const listing: BaTActiveListing = {
      listing_id: auction.id,
      url: auction.url,
      title: auction.title,
      year,
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
    };

    // Only fetch additional details if scrapeDetails is true
    if (this.scrapeDetails) {
      try {
        console.log(`Fetching additional details for listing ${auction.id}...`);
        const details = await fetchDetailsFromListingPage(auction.url);
        
        // Add the additional details to the listing
        if (details.mileage) listing.mileage = details.mileage;
        if (details.bidders) listing.bidders = details.bidders;
        if (details.watchers) listing.watchers = details.watchers;
        if (details.comments) listing.comments = details.comments;
        if (details.transmission) listing.transmission = details.transmission;
        if (details.color) listing.color = details.color;
        
        console.log(`Successfully added additional details for listing ${auction.id}`);
      } catch (error) {
        console.error(`Error fetching additional details for listing ${auction.id}:`, error);
      }
    }

    return listing;
  }
} 