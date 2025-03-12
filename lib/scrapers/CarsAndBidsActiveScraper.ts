import { BaseBATScraper } from './BaseBATScraper';
import * as playwright from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  parseBidAmount, 
  extractMakeFromTitle, 
  extractModelFromTitle,
  filterListingsByMake,
  filterListingsByModel,
  filterListingsByYear
} from './utils/BaTScraperUtils';

// Define the interface for Cars & Bids listings
export interface CarsAndBidsListing {
  id: string;
  url: string;
  title: string;
  year: string;
  make: string;
  model: string;
  current_bid: number;
  current_bid_formatted: string;
  endDate: number | null;
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
  mileage?: number;
  bidders?: number;
  watchers?: number;
  comments?: number;
  time_left?: string;
}

// Interface for scraper parameters
export interface CarsAndBidsScraperParams {
  make?: string;
  model?: string;
  yearMin?: number;
  yearMax?: number;
  debug?: boolean;
}

export class CarsAndBidsActiveScraper extends BaseBATScraper {
  private baseUrl = 'https://carsandbids.com';
  private searchUrl = 'https://carsandbids.com/auctions';
  private debugDir = './debug';

  constructor() {
    super({
      requestsPerMinute: 5, // Reduce request rate
      minRequestInterval: 5000, // Increase delay between requests
      cacheEnabled: false, // Disable caching to avoid issues
      maxRetries: 2, // Reduce retries to avoid getting blocked
      userAgents: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0'
      ]
    });
  }

  /**
   * Scrape active listings from Cars & Bids using Playwright
   */
  async scrape(params?: CarsAndBidsScraperParams): Promise<CarsAndBidsListing[]> {
    try {
      console.log(`Fetching active listings from ${this.searchUrl} using Playwright`);
      
      // Create debug directory if debug mode is enabled
      if (params?.debug) {
        try {
          await fs.mkdir(this.debugDir, { recursive: true });
          console.log(`Created debug directory: ${this.debugDir}`);
        } catch (error) {
          console.warn(`Could not create debug directory: ${error}`);
        }
      }
      
      // Launch a browser with Playwright
      const browser = await playwright.chromium.launch({
        headless: !(params?.debug === true) // Set to false for debugging
      });
      
      try {
        // Create a new browser context
        const context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
          viewport: { width: 1280, height: 800 },
          // Add additional browser context options as needed
        });
        
        // Create a new page
        const page = await context.newPage();
        
        // Enable console logging from the browser
        page.on('console', msg => console.log(`Browser console: ${msg.text()}`));
        
        // Navigate to the search URL
        console.log(`Navigating to ${this.searchUrl}`);
        await page.goto(this.searchUrl, { waitUntil: 'networkidle', timeout: 60000 });
        
        // Wait for any content to load
        console.log('Waiting for content to load...');
        
        // Wait for the body to be available
        await page.waitForSelector('body', { timeout: 30000 });
        
        // Take a screenshot for debugging
        if (params?.debug) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const screenshotPath = path.join(this.debugDir, `cars-and-bids-${timestamp}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          console.log(`Screenshot saved to ${screenshotPath}`);
        }
        
        // Save HTML for debugging
        if (params?.debug) {
          const html = await page.content();
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const htmlPath = path.join(this.debugDir, `cars-and-bids-${timestamp}.html`);
          await fs.writeFile(htmlPath, html);
          console.log(`HTML saved to ${htmlPath}`);
        }
        
        console.log('Extracting basic listing data from search page...');
        // Get basic listing data from the search page
        const basicListings = await this.extractBasicListingsFromPage(page);
        
        if (!basicListings || basicListings.length === 0) {
          console.log('No listings found on the page');
          return [];
        }
        
        console.log(`Found ${basicListings.length} active listings`);
        
        // Filter listings if parameters are provided
        let filteredListings = [...basicListings];
        
        if (params?.make) {
          filteredListings = filterListingsByMake(filteredListings, params.make);
          console.log(`Filtered to ${filteredListings.length} listings by make: ${params.make}`);
        }
        
        if (params?.model) {
          filteredListings = filterListingsByModel(filteredListings, params.model);
          console.log(`Filtered to ${filteredListings.length} listings by model: ${params.model}`);
        }
        
        if (params?.yearMin || params?.yearMax) {
          filteredListings = filterListingsByYear(
            filteredListings, 
            params?.yearMin || 0, 
            params?.yearMax || 9999
          );
          console.log(`Filtered to ${filteredListings.length} listings by year range: ${params?.yearMin || 'any'} - ${params?.yearMax || 'any'}`);
        }
        
        // Now visit each listing page to get detailed information
        console.log('Visiting individual listing pages to get detailed information...');
        const detailedListings: CarsAndBidsListing[] = [];
        
        // Limit to first 5 listings for testing purposes
        const listingsToProcess = filteredListings.slice(0, 5);
        console.log(`Processing only the first ${listingsToProcess.length} listings for testing purposes`);
        
        for (const basicListing of listingsToProcess) {
          try {
            console.log(`Visiting listing page: ${basicListing.url}`);
            const detailedListing = await this.getDetailedListingInfo(page, basicListing);
            if (detailedListing) {
              detailedListings.push(detailedListing);
            }
            
            // Add a delay between page visits to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 3000));
          } catch (error) {
            console.error(`Error getting detailed info for listing ${basicListing.id}:`, error);
            // If we can't get detailed info, still include the basic listing
            detailedListings.push(basicListing);
          }
        }
        
        // Add remaining listings with just basic info
        if (filteredListings.length > 5) {
          console.log(`Adding ${filteredListings.length - 5} remaining listings with basic info only`);
          for (let i = 5; i < filteredListings.length; i++) {
            detailedListings.push(filteredListings[i]);
          }
        }
        
        return detailedListings;
      } finally {
        // Always close the browser
        await browser.close();
      }
    } catch (error) {
      console.error('Error scraping Cars & Bids active listings:', error);
      return [];
    }
  }
  
  /**
   * Handle the case when scraping is blocked by the website
   */
  private handleScrapingBlocked(): CarsAndBidsListing[] {
    console.log('Cars & Bids is blocking our scraper. This is a common anti-scraping measure.');
    console.log('To access Cars & Bids data, you may need to:');
    console.log('1. Use a browser automation tool like Puppeteer or Playwright');
    console.log('2. Implement more sophisticated browser fingerprinting avoidance');
    console.log('3. Use a proxy rotation service');
    console.log('4. Check if Cars & Bids offers an official API');
    
    // Return an empty array since we couldn't get any listings
    return [];
  }

  /**
   * Extract basic listing information from the search page
   * Only extracts id, url, title, make, and model
   */
  private async extractBasicListingsFromPage(page: playwright.Page): Promise<CarsAndBidsListing[]> {
    console.log('Analyzing page structure...');
    
    // Try different selectors that might contain auction listings
    const selectors = [
      '.auction-item', 
      '.auction-card', 
      '.auction-listing',
      '.auction',
      '[data-auction-id]',
      'a[href*="/auctions/"]'
    ];
    
    let listingElements: playwright.ElementHandle<HTMLElement>[] = [];
    
    // Try each selector to find auction listings
    for (const selector of selectors) {
      const elements = await page.$$(selector);
      console.log(`Selector "${selector}" found ${elements.length} elements`);
      
      if (elements.length > 0) {
        console.log(`Using selector: ${selector}`);
        listingElements = elements as playwright.ElementHandle<HTMLElement>[];
        break;
      }
    }
    
    // If no elements found with specific selectors, try a more generic approach
    if (listingElements.length === 0) {
      console.log('No listings found with specific selectors, trying generic approach...');
      listingElements = await page.$$('a[href*="/auctions/"]') as playwright.ElementHandle<HTMLElement>[];
    }
    
    // Extract basic data from each listing element
    const listings: CarsAndBidsListing[] = [];
    
    for (const element of listingElements) {
      try {
        const listing = await this.extractBasicListingFromElement(page, element);
        if (listing) {
          listings.push(listing);
        }
      } catch (error) {
        console.error('Error extracting basic listing:', error);
      }
    }
    
    return listings;
  }

  /**
   * Extract only the essential fields from a listing element
   * (id, url, title, make, model)
   */
  private async extractBasicListingFromElement(page: playwright.Page, element: playwright.ElementHandle<HTMLElement>): Promise<CarsAndBidsListing | null> {
    try {
      // Extract the listing URL
      const url = await element.evaluate((el: HTMLElement) => {
        // Try to find a link within the element
        const link = el.querySelector('a[href*="/auctions/"]');
        
        // If there's a link, use its href
        if (link) {
          return link.getAttribute('href');
        }
        
        // If the element itself is a link, use its href
        if (el.tagName === 'A' && el.getAttribute('href')?.includes('/auctions/')) {
          return el.getAttribute('href');
        }
        
        return '';
      });
      
      // Format the URL properly
      const fullUrl = url ? (url.startsWith('http') ? url : `${this.baseUrl}${url}`) : '';
      
      if (!fullUrl) {
        console.warn('Could not extract URL from listing element');
        return null;
      }
      
      // Extract the listing ID from the URL
      const idMatch = fullUrl.match(/\/auctions\/([^\/]+)/);
      const id = idMatch ? idMatch[1] : '';
      
      if (!id) {
        console.warn(`Could not extract ID from URL: ${fullUrl}`);
        return null;
      }
      
      // Extract the title - try different selectors
      const title = await element.evaluate((el: HTMLElement) => {
        const titleSelectors = ['.auction-title', '.title', 'h2', 'h3', '.card-title'];
        
        // Try each selector
        for (const selector of titleSelectors) {
          const titleElement = el.querySelector(selector);
          if (titleElement && titleElement.textContent) {
            return titleElement.textContent.trim();
          }
        }
        
        // If no title found with selectors, try to extract from the full text
        const fullText = el.textContent || '';
        
        // Look for a pattern that might be a title (year + make + model)
        const titleMatch = fullText.match(/(\d{4}\s+[\w-]+\s+[\w-]+)/);
        if (titleMatch) {
          return titleMatch[1];
        }
        
        // Just use the first line of text
        return fullText.split('\n')[0] || '';
      });
      
      // Clean up the title - remove "Watch" suffix which appears in some titles
      const cleanTitle = title.replace(/Watch$/, '').trim();
      
      // Extract the year from the title
      const yearMatch = cleanTitle.match(/^(\d{4})/);
      const year = yearMatch ? yearMatch[1] : '';
      
      // Extract make and model from title
      const make = extractMakeFromTitle(cleanTitle);
      const model = extractModelFromTitle(cleanTitle, make);
      
      // Create a basic listing object with only the essential fields
      const listing: CarsAndBidsListing = {
        id,
        url: fullUrl,
        title: cleanTitle,
        year,
        make,
        model,
        current_bid: 0,
        current_bid_formatted: '',
        endDate: null,
        image_url: '',
        image_url_thumb: '',
        location: ''
      };
      
      return listing;
    } catch (error) {
      console.error('Error extracting basic listing data:', error);
      return null;
    }
  }

  /**
   * Visit a listing page and extract detailed information
   */
  private async getDetailedListingInfo(page: playwright.Page, basicListing: CarsAndBidsListing): Promise<CarsAndBidsListing | null> {
    try {
      // Navigate to the listing page
      await page.goto(basicListing.url, { waitUntil: 'networkidle', timeout: 60000 });
      
      // Wait for the content to load
      await page.waitForSelector('body', { timeout: 30000 });
      
      // Extract current bid
      const currentBidText = await page.evaluate(() => {
        const bidSelectors = [
          '.current-bid', 
          '.bid-amount', 
          '.price',
          '[data-bid-amount]',
          '.auction-bid-amount'
        ];
        
        for (const selector of bidSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            return element.textContent.trim();
          }
        }
        
        return '';
      });
      
      // Parse the bid amount
      let current_bid = 0;
      let current_bid_formatted = '';
      
      if (currentBidText) {
        // Clean up the bid text
        const cleanBidText = currentBidText.replace(/^(Bid to|Current Bid:|Price:|Sold for:)\s*/i, '').trim();
        
        // Parse the bid amount
        current_bid = parseBidAmount(cleanBidText);
        current_bid_formatted = cleanBidText;
        
        // Ensure the current_bid_formatted is properly formatted
        if (current_bid > 0 && (!current_bid_formatted || !current_bid_formatted.includes('$'))) {
          current_bid_formatted = '$' + current_bid.toLocaleString('en-US');
        }
      }
      
      // Extract time left
      const timeLeftText = await page.evaluate(() => {
        const timeSelectors = [
          '.time-left', 
          '.auction-time-left', 
          '.ends-in', 
          '.time-remaining', 
          '.countdown'
        ];
        
        for (const selector of timeSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            return element.textContent.trim();
          }
        }
        
        return '';
      });
      
      // Clean up the time left text
      const time_left = timeLeftText.replace(/^Time Left\s*/i, '').trim();
      
      // Calculate end date from time left text
      let endDate: number | null = null;
      
      if (time_left && time_left !== 'Active') {
        const now = new Date();
        
        if (time_left.includes('day') || time_left.includes('Day')) {
          const daysMatch = time_left.match(/(\d+)\s*[dD]ay/);
          if (daysMatch) {
            const days = parseInt(daysMatch[1], 10);
            endDate = now.getTime() + days * 24 * 60 * 60 * 1000;
          }
        } else if (time_left.includes('hour') || time_left.includes('Hour')) {
          const hoursMatch = time_left.match(/(\d+)\s*[hH]our/);
          if (hoursMatch) {
            const hours = parseInt(hoursMatch[1], 10);
            endDate = now.getTime() + hours * 60 * 60 * 1000;
          }
        } else if (time_left.includes('minute') || time_left.includes('Minute')) {
          const minutesMatch = time_left.match(/(\d+)\s*[mM]inute/);
          if (minutesMatch) {
            const minutes = parseInt(minutesMatch[1], 10);
            endDate = now.getTime() + minutes * 60 * 1000;
          }
        }
      }
      
      // Extract image URL
      const image_url = await page.evaluate(() => {
        const imgSelectors = [
          '.auction-image img', 
          '.main-image img', 
          '.carousel-image img',
          '.gallery-image img',
          '.auction-gallery img'
        ];
        
        for (const selector of imgSelectors) {
          const element = document.querySelector(selector);
          if (element && element.getAttribute('src')) {
            return element.getAttribute('src');
          }
        }
        
        return '';
      });
      
      // Extract location
      const location = await page.evaluate(() => {
        const locationSelectors = [
          '.auction-location', 
          '.location', 
          '.seller-location',
          '[data-location]'
        ];
        
        for (const selector of locationSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            return element.textContent.trim();
          }
        }
        
        return '';
      });
      
      // Extract no reserve status
      const no_reserve = await page.evaluate(() => {
        const reserveSelectors = [
          '.no-reserve', 
          '.auction-badge', 
          '.badge'
        ];
        
        for (const selector of reserveSelectors) {
          const elements = document.querySelectorAll(selector);
          for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            if (element && element.textContent && element.textContent.includes('No Reserve')) {
              return true;
            }
          }
        }
        
        return document.body.textContent?.includes('No Reserve') || false;
      });
      
      // Extract mileage
      const mileage = await page.evaluate(() => {
        const mileageSelectors = [
          '.mileage', 
          '.odometer', 
          '.vehicle-mileage',
          '[data-mileage]'
        ];
        
        for (const selector of mileageSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            const text = element.textContent.trim();
            const match = text.match(/(\d+[,\d]*)/);
            if (match) {
              return parseInt(match[1].replace(/,/g, ''));
            }
          }
        }
        
        // Try to find mileage in the page content
        const content = document.body.textContent || '';
        const mileageMatch = content.match(/(\d+[,\d]*)\s*miles/i);
        if (mileageMatch) {
          return parseInt(mileageMatch[1].replace(/,/g, ''));
        }
        
        return undefined;
      });
      
      // Merge the detailed information with the basic listing
      return {
        ...basicListing,
        current_bid,
        current_bid_formatted,
        endDate,
        image_url: image_url || '',
        image_url_thumb: image_url || '', // Use the same image for thumbnail
        location,
        no_reserve,
        time_left,
        mileage
      };
    } catch (error) {
      console.error(`Error getting detailed info for listing ${basicListing.id}:`, error);
      return basicListing; // Return the basic listing if we can't get detailed info
    }
  }
} 