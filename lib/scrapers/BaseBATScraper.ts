/**
 * Base BAT Scraper Class
 * 
 * This abstract class provides common functionality for all BAT scrapers, including:
 * - Rate limiting and request throttling
 * - Error handling and retry mechanisms
 * - Logging utilities
 */

import '../server-only';

// Import Node.js modules conditionally
let setTimeout: any;

// Only import Node.js modules on the server
if (typeof window === 'undefined') {
  // Use regular imports instead of node: protocol
  setTimeout = global.setTimeout;
}

// Types for scraper configuration
export interface ScraperConfig {
  // Rate limiting
  requestsPerMinute?: number;
  minRequestInterval?: number; // in milliseconds
  
  // Retry configuration
  maxRetries?: number;
  retryDelay?: number; // in milliseconds
  retryMultiplier?: number; // multiplier for exponential backoff
  
  // User agent rotation
  userAgents?: string[];
  
  // Proxy configuration
  proxies?: string[];
  
  // Logging
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

// Default configuration
const DEFAULT_CONFIG: ScraperConfig = {
  requestsPerMinute: 30,
  minRequestInterval: 2000,
  maxRetries: 3,
  retryDelay: 1000,
  retryMultiplier: 2,
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
  ],
  logLevel: 'info'
};

export abstract class BaseBATScraper {
  protected config: ScraperConfig;
  protected lastRequestTime: number = 0;
  protected requestCount: number = 0;
  protected requestCountResetTime: number = 0;
  
  constructor(config: ScraperConfig = {}) {
    // Merge provided config with defaults
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Abstract method that must be implemented by all scrapers
   * This is the main entry point for scraping
   */
  abstract scrape(params?: any): Promise<any>;
  
  /**
   * Fetch a URL with rate limiting and retries
   */
  protected async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    // Apply rate limiting
    await this.applyRateLimiting();
    
    // Set up headers with random user agent
    const headers = new Headers(options.headers || {});
    
    if (!headers.has('User-Agent') && this.config.userAgents && this.config.userAgents.length > 0) {
      const randomUserAgent = this.config.userAgents[Math.floor(Math.random() * this.config.userAgents.length)];
      headers.set('User-Agent', randomUserAgent);
    }
    
    // Update options with the new headers
    options = {
      ...options,
      headers
    };
    
    // Attempt the request with retries
    let retries = 0;
    let lastError: Error | null = null;
    
    while (retries <= (this.config.maxRetries || 0)) {
      try {
        this.log('debug', `Fetching ${url} (attempt ${retries + 1})`);
        
        const response = await fetch(url, options);
        this.lastRequestTime = Date.now();
        
        // Check if the response is successful
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.log('warn', `Request failed: ${lastError.message}`);
        
        // If we've reached max retries, throw the error
        if (retries >= (this.config.maxRetries || 0)) {
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = (this.config.retryDelay || 1000) * Math.pow(this.config.retryMultiplier || 2, retries);
        this.log('info', `Retrying in ${delay}ms...`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
      }
    }
    
    // If we get here, all retries failed
    throw lastError || new Error('Request failed after multiple retries');
  }
  
  /**
   * Apply rate limiting based on configuration
   */
  protected async applyRateLimiting(): Promise<void> {
    const now = Date.now();
    
    // Reset request count if we're in a new minute
    if (now - this.requestCountResetTime > 60000) {
      this.requestCount = 0;
      this.requestCountResetTime = now;
    }
    
    // Check if we've exceeded the requests per minute
    if (this.requestCount >= (this.config.requestsPerMinute || 30)) {
      const timeToNextMinute = 60000 - (now - this.requestCountResetTime);
      this.log('debug', `Rate limit reached. Waiting ${timeToNextMinute}ms`);
      await new Promise(resolve => setTimeout(resolve, timeToNextMinute));
      this.requestCount = 0;
      this.requestCountResetTime = Date.now();
      return;
    }
    
    // Ensure minimum interval between requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < (this.config.minRequestInterval || 0)) {
      const waitTime = (this.config.minRequestInterval || 0) - timeSinceLastRequest;
      this.log('debug', `Throttling request. Waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // Increment request count
    this.requestCount++;
  }
  
  /**
   * Logging utility
   */
  protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    const logLevels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    // Only log if the level is high enough
    if (logLevels[level] >= logLevels[this.config.logLevel || 'info']) {
      const timestamp = new Date().toISOString();
      const scraperName = this.constructor.name;
      
      // Format the log message
      const formattedMessage = `[${timestamp}] [${scraperName}] [${level.toUpperCase()}] ${message}`;
      
      // Log to appropriate console method
      switch (level) {
        case 'debug':
          console.debug(formattedMessage);
          break;
        case 'info':
          console.info(formattedMessage);
          break;
        case 'warn':
          console.warn(formattedMessage);
          break;
        case 'error':
          console.error(formattedMessage);
          break;
      }
    }
  }
  
  /**
   * Parse HTML content
   */
  protected parseHTML(html: string): Document {
    // Use JSDOM in Node.js environment
    if (typeof window === 'undefined') {
      const { JSDOM } = require('jsdom');
      const dom = new JSDOM(html);
      return dom.window.document;
    }
    
    // Use DOMParser in browser environment
    const parser = new DOMParser();
    return parser.parseFromString(html, 'text/html');
  }
  
  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    // Override in subclasses if needed
  }
  
  /**
   * Fetches HTML content from a URL with rate limiting
   * @param url The URL to fetch
   * @param options Optional fetch options
   * @returns The HTML content as a string
   */
  protected async fetchHtml(url: string, options: RequestInit = {}): Promise<string> {
    try {
      // Set default headers if not provided
      const headers = new Headers(options.headers || {});
      
      if (!headers.has('User-Agent') && this.config.userAgents && this.config.userAgents.length > 0) {
        const randomUserAgent = this.config.userAgents[Math.floor(Math.random() * this.config.userAgents.length)];
        headers.set('User-Agent', randomUserAgent);
      }
      
      // Update options with the headers
      const fetchOptions = {
        ...options,
        headers
      };
      
      // Use the fetch method which handles rate limiting
      const response = await this.fetch(url, fetchOptions);
      
      // Get the HTML text from the response
      const html = await response.text();
      return html;
    } catch (error) {
      this.log('error', `Error fetching HTML from ${url}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
} 