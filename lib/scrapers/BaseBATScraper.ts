/**
 * Base BAT Scraper Class
 * 
 * This abstract class provides common functionality for all BAT scrapers, including:
 * - Rate limiting and request throttling
 * - Error handling and retry mechanisms
 * - Logging utilities
 * - Caching mechanisms for responses
 */

import '../server-only';

// Import Node.js modules conditionally
let setTimeout: any;
let createHash: any;
let fs: any;
let path: any;

// Only import Node.js modules on the server
if (typeof window === 'undefined') {
  // Use regular imports instead of node: protocol
  setTimeout = global.setTimeout;
  
  try {
    const crypto = require('crypto');
    createHash = crypto.createHash;
  } catch (error) {
    // Provide a fallback implementation
    createHash = (algorithm: string) => ({
      update: (data: string) => ({
        digest: (encoding: string) => {
          // Simple hash function for fallback
          let hash = 0;
          for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
          }
          return hash.toString(16);
        }
      })
    });
  }
  
  try {
    path = require('path');
  } catch (error) {
    // Provide a fallback implementation
    path = {
      join: (...parts: string[]) => parts.filter(Boolean).join('/'),
      dirname: (p: string) => p.split('/').slice(0, -1).join('/')
    };
  }
  
  try {
    fs = require('fs/promises');
  } catch (error) {
    // Provide a fallback or no-op implementation
    fs = {
      readFile: async () => '',
      writeFile: async () => {},
      mkdir: async () => {},
      access: async () => { throw new Error('File not found'); }
    };
  }
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
  
  // Caching configuration
  cacheEnabled?: boolean;
  cacheTTL?: number; // in milliseconds
  cacheDir?: string;
  
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
  cacheEnabled: true,
  cacheTTL: 24 * 60 * 60 * 1000, // 24 hours
  cacheDir: '/tmp/cache',
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
    
    // Initialize cache directory asynchronously
    if (this.config.cacheEnabled && this.config.cacheDir) {
      // We'll initialize the cache directory asynchronously
      // but we won't wait for it to complete
      this.initializeCacheDir();
    }
  }
  
  /**
   * Initialize the cache directory asynchronously
   */
  private async initializeCacheDir(): Promise<void> {
    try {
      // Wait a bit to ensure imports have completed
      await new Promise(resolve => setTimeout(resolve, 100));
      await this.ensureCacheDir();
    } catch (error: any) {
      this.log('error', `Failed to initialize cache directory: ${error.message}`);
    }
  }
  
  /**
   * Abstract method that must be implemented by all scrapers
   * This is the main entry point for scraping
   */
  abstract scrape(params?: any): Promise<any>;
  
  /**
   * Fetch a URL with rate limiting, retries, and caching
   */
  protected async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    // Apply rate limiting
    await this.applyRateLimiting();
    
    // Generate a cache key for this request
    const cacheKey = this.getCacheKey(url, options);
    
    // Try to get a cached response
    const cachedResponse = await this.getCachedResponse(cacheKey);
    if (cachedResponse) {
      this.log('debug', `Using cached response for ${url}`);
      return cachedResponse;
    }
    
    // Set up headers with a random user agent if available
    const headers = new Headers(options.headers || {});
    if (!headers.has('User-Agent') && this.config.userAgents && this.config.userAgents.length > 0) {
      const randomUserAgent = this.config.userAgents[Math.floor(Math.random() * this.config.userAgents.length)];
      headers.set('User-Agent', randomUserAgent);
      this.log('debug', `Using User-Agent: ${randomUserAgent}`);
    }
    
    // Update options with headers
    const fetchOptions: RequestInit = {
      ...options,
      headers
    };
    
    // Retry logic
    let retries = 0;
    const maxRetries = this.config.maxRetries || 3;
    let retryDelay = this.config.retryDelay || 1000;
    const retryMultiplier = this.config.retryMultiplier || 2;
    
    while (true) {
      try {
        const response = await fetch(url, fetchOptions);
        
        // Cache successful responses
        if (response.ok && this.config.cacheEnabled) {
          await this.cacheResponse(cacheKey, response.clone());
        } else if (!response.ok) {
          this.log('warn', `Request failed: HTTP error ${response.status}: ${response.statusText}`);
        }
        
        return response;
      } catch (error) {
        if (retries >= maxRetries) {
          this.log('error', `Failed after ${maxRetries} retries: ${error}`);
          throw error;
        }
        
        retries++;
        this.log('info', `Retrying in ${retryDelay}ms...`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        // Increase delay for next retry
        retryDelay *= retryMultiplier;
      }
    }
  }
  
  /**
   * Apply rate limiting to avoid overloading the server
   */
  protected async applyRateLimiting(): Promise<void> {
    const now = Date.now();
    
    // Reset request count if we're in a new minute
    if (now - this.requestCountResetTime >= 60000) {
      this.requestCount = 0;
      this.requestCountResetTime = now;
    }
    
    // Check if we've exceeded the requests per minute limit
    const requestsPerMinute = this.config.requestsPerMinute || 30;
    if (this.requestCount >= requestsPerMinute) {
      const timeToNextMinute = 60000 - (now - this.requestCountResetTime);
      this.log('debug', `Rate limit reached. Waiting ${timeToNextMinute}ms before next request`);
      await new Promise(resolve => setTimeout(resolve, timeToNextMinute));
      
      // Reset after waiting
      this.requestCount = 0;
      this.requestCountResetTime = Date.now();
    }
    
    // Apply minimum interval between requests
    const minInterval = this.config.minRequestInterval || 1000;
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      this.log('debug', `Waiting ${waitTime}ms between requests`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // Update request count and last request time
    this.requestCount++;
    this.lastRequestTime = Date.now();
  }
  
  /**
   * Generate a cache key for a request
   */
  protected getCacheKey(url: string, options: RequestInit): string {
    try {
      // Create a string representation of the request
      const requestStr = JSON.stringify({
        url,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body || ''
      });
      
      // Generate a hash of the request string
      if (typeof createHash === 'function') {
        return createHash('md5').update(requestStr).digest('hex');
      } else {
        // Fallback to a simple hash function
        let hash = 0;
        for (let i = 0; i < requestStr.length; i++) {
          const char = requestStr.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(16);
      }
    } catch (error) {
      // If hashing fails, use a timestamp-based key
      return `${url.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    }
  }
  
  /**
   * Get a cached response for a request
   */
  protected async getCachedResponse(cacheKey: string): Promise<Response | null> {
    if (!this.config.cacheEnabled) {
      return null;
    }
    
    try {
      // Ensure cache directory exists
      await this.ensureCacheDir();
      
      // Get the cache file path
      const cacheDir = this.config.cacheDir || '/tmp/cache';
      const cacheFilePath = path && path.join ? path.join(cacheDir, `${cacheKey}.json`) : `${cacheDir}/${cacheKey}.json`;
      
      // Check if the cache file exists
      try {
        await fs.access(cacheFilePath);
      } catch (error) {
        // Cache file doesn't exist
        return null;
      }
      
      // Read the cache file
      const cacheData = JSON.parse(await fs.readFile(cacheFilePath, 'utf-8'));
      
      // Check if the cache is expired
      const now = Date.now();
      if (cacheData.expiresAt && cacheData.expiresAt < now) {
        // Cache is expired
        return null;
      }
      
      // Create a Response object from the cached data
      return new Response(cacheData.body, {
        status: cacheData.status,
        statusText: cacheData.statusText,
        headers: cacheData.headers
      });
    } catch (error) {
      this.log('warn', `Error getting cached response: ${error}`);
      return null;
    }
  }
  
  /**
   * Cache a response for future use
   */
  protected async cacheResponse(cacheKey: string, response: Response): Promise<void> {
    if (!this.config.cacheEnabled) {
      return;
    }
    
    try {
      // Ensure cache directory exists
      await this.ensureCacheDir();
      
      // Clone the response since it can only be read once
      const clonedResponse = response.clone();
      
      // Get the response body as text
      const body = await clonedResponse.text();
      
      // Create the cache data object
      const cacheData = {
        body,
        status: clonedResponse.status,
        statusText: clonedResponse.statusText,
        headers: Object.fromEntries(clonedResponse.headers.entries()),
        expiresAt: Date.now() + (this.config.cacheTTL || 24 * 60 * 60 * 1000) // Default to 24 hours
      };
      
      // Get the cache file path
      const cacheDir = this.config.cacheDir || '/tmp/cache';
      const cacheFilePath = path && path.join ? path.join(cacheDir, `${cacheKey}.json`) : `${cacheDir}/${cacheKey}.json`;
      
      // Write the cache file
      await fs.writeFile(cacheFilePath, JSON.stringify(cacheData));
      
      this.log('debug', `Cached response for key ${cacheKey}`);
    } catch (error) {
      this.log('warn', `Error caching response: ${error}`);
    }
  }
  
  /**
   * Ensure the cache directory exists
   */
  protected async ensureCacheDir(): Promise<void> {
    if (!this.config.cacheEnabled) {
      return;
    }
    
    try {
      const cacheDir = this.config.cacheDir || '/tmp/cache';
      
      // Check if the directory exists
      try {
        await fs.access(cacheDir);
      } catch (error) {
        // Directory doesn't exist, create it
        await fs.mkdir(cacheDir, { recursive: true });
        this.log('debug', `Created cache directory: ${cacheDir}`);
      }
    } catch (error) {
      this.log('warn', `Error ensuring cache directory: ${error}`);
    }
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
   * Fetch HTML content from a URL
   */
  protected async fetchHtml(url: string, options: RequestInit = {}): Promise<string> {
    try {
      const response = await this.fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      return await response.text();
    } catch (error) {
      this.log('error', `Error fetching HTML from ${url}: ${error}`);
      throw error;
    }
  }
} 