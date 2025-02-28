/**
 * Base Scraper Class
 * 
 * This abstract class provides common functionality for all scrapers, including:
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
  import('timers/promises').then(module => { setTimeout = module.setTimeout }).catch(() => {
    // Fallback to global setTimeout if module import fails
    setTimeout = global.setTimeout;
  });
  
  import('crypto').then(module => { createHash = module.createHash }).catch(() => {
    // Provide a fallback or no-op implementation
    createHash = (algorithm: string) => ({
      update: (data: string) => ({
        digest: (encoding: string) => 'mock-hash'
      })
    });
  });
  
  import('fs/promises').then(module => { fs = module }).catch(() => {
    // Provide a fallback or no-op implementation
    fs = {
      readFile: async () => '',
      writeFile: async () => {},
      mkdir: async () => {},
      access: async () => { throw new Error('File not found'); }
    };
  });
  
  import('path').then(module => { path = module }).catch(() => {
    // Provide a fallback or no-op implementation
    path = {
      join: (...parts: string[]) => parts.join('/'),
      dirname: (p: string) => p.split('/').slice(0, -1).join('/')
    };
  });
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
  cacheDir: '.cache',
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
  ],
  logLevel: 'info'
};

export abstract class BaseScraper {
  protected config: ScraperConfig;
  protected lastRequestTime: number = 0;
  protected requestCount: number = 0;
  protected requestCountResetTime: number = 0;
  
  constructor(config: ScraperConfig = {}) {
    // Merge provided config with defaults
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Create cache directory if it doesn't exist
    if (this.config.cacheEnabled && this.config.cacheDir) {
      this.ensureCacheDir().catch(err => {
        this.log('error', `Failed to create cache directory: ${err.message}`);
      });
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
    const cacheKey = this.getCacheKey(url, options);
    
    // Check cache first if enabled
    if (this.config.cacheEnabled) {
      const cachedResponse = await this.getCachedResponse(cacheKey);
      if (cachedResponse) {
        this.log('debug', `Cache hit for ${url}`);
        return cachedResponse;
      }
    }
    
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
        
        // Clone the response before caching it
        const responseClone = response.clone();
        
        // Cache the response if caching is enabled
        if (this.config.cacheEnabled) {
          this.cacheResponse(cacheKey, responseClone).catch(err => {
            this.log('error', `Failed to cache response: ${err.message}`);
          });
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
        await setTimeout(delay);
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
      await setTimeout(timeToNextMinute);
      this.requestCount = 0;
      this.requestCountResetTime = Date.now();
      return;
    }
    
    // Ensure minimum interval between requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < (this.config.minRequestInterval || 0)) {
      const waitTime = (this.config.minRequestInterval || 0) - timeSinceLastRequest;
      this.log('debug', `Throttling request. Waiting ${waitTime}ms`);
      await setTimeout(waitTime);
    }
    
    // Increment request count
    this.requestCount++;
  }
  
  /**
   * Generate a cache key for a request
   */
  protected getCacheKey(url: string, options: RequestInit): string {
    const hash = createHash('md5');
    hash.update(url);
    
    // Include relevant parts of options in the cache key
    if (options.method) {
      hash.update(options.method);
    }
    
    if (options.body) {
      hash.update(String(options.body));
    }
    
    return hash.digest('hex');
  }
  
  /**
   * Get a cached response if it exists and is not expired
   */
  protected async getCachedResponse(cacheKey: string): Promise<Response | null> {
    if (!this.config.cacheEnabled || !this.config.cacheDir) {
      return null;
    }
    
    const cacheFilePath = path.join(this.config.cacheDir, `${cacheKey}.json`);
    
    try {
      // Check if cache file exists
      await fs.access(cacheFilePath);
      
      // Read cache file
      const cacheData = JSON.parse(await fs.readFile(cacheFilePath, 'utf-8'));
      
      // Check if cache is expired
      if (Date.now() - cacheData.timestamp > (this.config.cacheTTL || 0)) {
        this.log('debug', `Cache expired for key ${cacheKey}`);
        return null;
      }
      
      // Reconstruct response from cache
      return new Response(cacheData.body, {
        status: cacheData.status,
        statusText: cacheData.statusText,
        headers: cacheData.headers
      });
    } catch (error) {
      // If file doesn't exist or can't be read, return null
      return null;
    }
  }
  
  /**
   * Cache a response
   */
  protected async cacheResponse(cacheKey: string, response: Response): Promise<void> {
    if (!this.config.cacheEnabled || !this.config.cacheDir) {
      return;
    }
    
    // Clone the response to avoid consuming it
    const responseClone = response.clone();
    
    // Extract data to cache
    const body = await responseClone.text();
    const headers = Object.fromEntries(responseClone.headers.entries());
    
    const cacheData = {
      timestamp: Date.now(),
      url: responseClone.url,
      status: responseClone.status,
      statusText: responseClone.statusText,
      headers,
      body
    };
    
    // Write to cache file
    const cacheFilePath = path.join(this.config.cacheDir, `${cacheKey}.json`);
    await fs.writeFile(cacheFilePath, JSON.stringify(cacheData), 'utf-8');
  }
  
  /**
   * Ensure cache directory exists
   */
  protected async ensureCacheDir(): Promise<void> {
    if (!this.config.cacheDir) {
      return;
    }
    
    try {
      await fs.access(this.config.cacheDir);
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(this.config.cacheDir, { recursive: true });
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
} 