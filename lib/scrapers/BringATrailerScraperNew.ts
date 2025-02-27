import { BaseScraper } from './BaseScraper';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Define our own BaTListing interface
export interface BaTListing {
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
export interface BaTScraperParams {
  make?: string;
  model?: string;
  yearMin?: number;
  yearMax?: number;
}

export class BringATrailerScraper extends BaseScraper {
  private baseUrl = 'https://bringatrailer.com';
  private searchUrl = 'https://bringatrailer.com/auctions/';

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

  async scrape(): Promise<BaTListing[]> {
    try {
      console.log(`Fetching recent listings from ${this.searchUrl}`);
      const html = await this.fetchHtml(this.searchUrl);
      
      // Save HTML for debugging
      const debugDir = path.join(process.cwd(), 'debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir);
      }
      const debugFile = path.join(debugDir, `bat_debug_${Date.now()}.html`);
      fs.writeFileSync(debugFile, html);
      console.log(`Saved debug HTML to ${debugFile}`);
      
      const auctionsData = await this.extractAuctionsData(html);
      
      if (!auctionsData || !auctionsData.auctions || auctionsData.auctions.length === 0) {
        console.log('No auction data found');
        return [];
      }
      
      console.log(`Found ${auctionsData.auctions.length} auctions`);
      
      const listings: BaTListing[] = auctionsData.auctions.map(auction => 
        this.convertAuctionToBaTListing(auction)
      );
      
      // Save listings to file for debugging
      const listingsFile = path.join(process.cwd(), 'recent_listings.json');
      fs.writeFileSync(listingsFile, JSON.stringify(listings, null, 2));
      console.log(`Saved ${listings.length} listings to ${listingsFile}`);
      
      return listings;
    } catch (error) {
      console.error('Error scraping BaT:', error);
      return [];
    }
  }

  async searchListings(params: BaTScraperParams): Promise<BaTListing[]> {
    try {
      // Construct search URL based on parameters
      let searchUrl = this.searchUrl;
      
      // Add query parameters if provided
      const queryParams: string[] = [];
      if (params.make) {
        queryParams.push(`s=${encodeURIComponent(params.make)}`);
      }
      
      if (queryParams.length > 0) {
        searchUrl += `?${queryParams.join('&')}`;
      }
      
      console.log(`Searching listings with URL: ${searchUrl}`);
      
      const html = await this.fetchHtml(searchUrl);
      
      // Save HTML for debugging
      const debugDir = path.join(process.cwd(), 'debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir);
      }
      const debugFile = path.join(debugDir, `bat_debug_${Date.now()}.html`);
      fs.writeFileSync(debugFile, html);
      console.log(`Saved debug HTML to ${debugFile}`);
      
      const auctionsData = await this.extractAuctionsData(html);
      
      if (!auctionsData || !auctionsData.auctions || auctionsData.auctions.length === 0) {
        console.log('No auction data found for query');
        return [];
      }
      
      console.log(`Found ${auctionsData.auctions.length} auctions for query`);
      
      // Filter results based on parameters
      let filteredAuctions = auctionsData.auctions;
      
      // Filter by make if provided
      if (params.make) {
        const makeLower = params.make.toLowerCase();
        filteredAuctions = filteredAuctions.filter(auction => {
          // Check if make is in title or searchable field
          return auction.title.toLowerCase().includes(makeLower);
        });
      }
      
      // Filter by model if provided
      if (params.model) {
        const modelLower = params.model.toLowerCase();
        filteredAuctions = filteredAuctions.filter(auction => {
          // Check if model is in title or searchable field
          return auction.title.toLowerCase().includes(modelLower);
        });
      }
      
      // Filter by year range if provided
      if (params.yearMin || params.yearMax) {
        filteredAuctions = filteredAuctions.filter(auction => {
          const year = parseInt(auction.year);
          if (isNaN(year)) return false;
          
          if (params.yearMin && year < params.yearMin) return false;
          if (params.yearMax && year > params.yearMax) return false;
          
          return true;
        });
      }
      
      console.log(`Filtered to ${filteredAuctions.length} auctions`);
      
      const listings: BaTListing[] = filteredAuctions.map(auction => 
        this.convertAuctionToBaTListing(auction)
      );
      
      return listings;
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
      // Look for JSON objects that match the auction structure
      const regex = /"active":true,"categories":\[.*?\],"comments":.*?"id":\d+/g;
      const matches = html.match(regex);
      
      if (!matches || matches.length === 0) {
        console.log('No auction data matches found in HTML');
        return null;
      }
      
      console.log(`Found ${matches.length} potential auction objects`);
      
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
          
          if (auction && auction.id && auction.url && auction.title) {
            auctions.push(auction);
          }
        } catch (e) {
          console.error('Error parsing auction object:', e);
        }
      }
      
      if (auctions.length > 0) {
        console.log(`Successfully extracted ${auctions.length} auction objects`);
        return auctions;
      }
      
      return null;
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
          const currentBidText = $el.find('.auction-price').text().trim();
          const currentBid = parseInt(currentBidText.replace(/[^0-9]/g, '')) || 0;
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
              current_bid_formatted: currentBidText,
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

  private convertAuctionToBaTListing(auction: BaTAuction): BaTListing {
    // Extract location from country
    const location = auction.country || '';
    
    // Convert timestamp to Date
    const endDate = auction.timestamp_end * 1000; // Convert to milliseconds
    
    return {
      id: auction.id,
      url: auction.url,
      title: auction.title,
      year: auction.year,
      make: this.extractMakeFromTitle(auction.title),
      model: this.extractModelFromTitle(auction.title, this.extractMakeFromTitle(auction.title)),
      current_bid: auction.current_bid,
      current_bid_formatted: auction.current_bid_formatted,
      endDate,
      image_url: auction.thumbnail_url,
      image_url_thumb: auction.thumbnail_url,
      location,
      no_reserve: auction.noreserve,
      premium: auction.premium
    };
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
    
    // Check if any of the common makes are in the title
    for (const make of commonMakes) {
      if (title.includes(make)) {
        return make;
      }
    }
    
    // If no common make is found, try to extract the make from the year pattern
    // e.g., "1995 Porsche 911" -> "Porsche"
    const yearMakePattern = /\d{4}\s+([A-Za-z-]+)/;
    const match = title.match(yearMakePattern);
    
    if (match && match[1]) {
      return match[1];
    }
    
    return '';
  }
  
  private extractModelFromTitle(title: string, make: string): string {
    if (!make) return '';
    
    // Try to extract the model after the make
    const modelPattern = new RegExp(`${make}\\s+([A-Za-z0-9-]+)`);
    const match = title.match(modelPattern);
    
    if (match && match[1]) {
      return match[1];
    }
    
    return '';
  }
} 