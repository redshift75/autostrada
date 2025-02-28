import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { BringATrailerResultsScraper, BaTCompletedListing } from "../scrapers/BringATrailerResultsScraper";
import { generatePriceTimeSeriesChart, generatePriceHistogram, generatePriceYearScatterPlot } from "../utils/visualization";

// Tool to search for vehicles by criteria
export const createVehicleSearchTool = () => {
  return new DynamicStructuredTool({
    name: "search_vehicles",
    description: "Search for vehicles based on make, model, year, and other criteria",
    schema: z.object({
      make: z.string().optional().describe("The manufacturer of the vehicle"),
      model: z.string().optional().describe("The model of the vehicle"),
      yearStart: z.number().optional().describe("The starting year in a range"),
      yearEnd: z.number().optional().describe("The ending year in a range"),
      priceMin: z.number().optional().describe("The minimum price"),
      priceMax: z.number().optional().describe("The maximum price"),
      condition: z.string().optional().describe("The condition of the vehicle"),
    }),
    func: async ({ make, model, yearStart, yearEnd, priceMin, priceMax, condition }) => {
      // This would connect to your database in a real implementation
      // For now, return a placeholder response
      return JSON.stringify({
        results: [
          {
            id: 1,
            make: make || "Porsche",
            model: model || "911",
            year: yearStart || 1973,
            price: priceMin || 150000,
            condition: condition || "excellent",
            description: "Matching search criteria"
          }
        ],
        count: 1
      });
    },
  });
};

// Tool to get price history for a specific vehicle or model
export const createPriceHistoryTool = () => {
  return new DynamicStructuredTool({
    name: "get_price_history",
    description: "Get historical price data for a specific vehicle make/model",
    schema: z.object({
      make: z.string().describe("The manufacturer of the vehicle"),
      model: z.string().describe("The model of the vehicle"),
      yearStart: z.number().optional().describe("The starting year in a range"),
      yearEnd: z.number().optional().describe("The ending year in a range"),
      timeframe: z.string().optional().describe("The timeframe for historical data (e.g., '5y', '1y', '6m')"),
    }),
    func: async ({ make, model, yearStart, yearEnd, timeframe }) => {
      // This would connect to your database in a real implementation
      // For now, return a placeholder response
      return JSON.stringify({
        make,
        model,
        yearRange: `${yearStart || "any"} - ${yearEnd || "any"}`,
        timeframe: timeframe || "5y",
        priceHistory: [
          { date: "2018-01", avgPrice: 120000 },
          { date: "2019-01", avgPrice: 125000 },
          { date: "2020-01", avgPrice: 135000 },
          { date: "2021-01", avgPrice: 155000 },
          { date: "2022-01", avgPrice: 175000 },
          { date: "2023-01", avgPrice: 185000 },
        ],
        trend: "appreciating",
        percentChange: "+54.2%"
      });
    },
  });
};

// Tool to get detailed information about a specific vehicle
export const createVehicleDetailTool = () => {
  return new DynamicStructuredTool({
    name: "get_vehicle_details",
    description: "Get detailed information about a specific vehicle by ID",
    schema: z.object({
      vehicleId: z.number().describe("The ID of the vehicle to retrieve details for"),
    }),
    func: async ({ vehicleId }) => {
      // This would connect to your database in a real implementation
      // For now, return a placeholder response
      return JSON.stringify({
        id: vehicleId,
        make: "Porsche",
        model: "911",
        year: 1973,
        trim: "Carrera RS",
        engine: "2.7L flat-six",
        transmission: "5-speed manual",
        drivetrain: "RWD",
        exteriorColor: "Grand Prix White",
        interiorColor: "Black",
        mileage: 45000,
        condition: "excellent",
        price: 750000,
        location: "Los Angeles, CA",
        description: "Matching numbers example with documented history",
        features: [
          "Lightweight specification",
          "Original engine",
          "Factory documentation",
          "Recent service"
        ],
        images: [
          "https://example.com/image1.jpg",
          "https://example.com/image2.jpg"
        ]
      });
    },
  });
};

// Tool to get market analysis for a vehicle segment
export const createMarketAnalysisTool = () => {
  return new DynamicStructuredTool({
    name: "get_market_analysis",
    description: "Get market analysis for a specific vehicle segment or type",
    schema: z.object({
      segment: z.string().describe("The market segment to analyze (e.g., 'air-cooled Porsche', 'vintage Ferrari', 'muscle cars')"),
      timeframe: z.string().optional().describe("The timeframe for analysis (e.g., '5y', '1y', '6m')"),
    }),
    func: async ({ segment, timeframe }) => {
      // This would connect to your database in a real implementation
      // For now, return a placeholder response
      return JSON.stringify({
        segment,
        timeframe: timeframe || "5y",
        overallTrend: "appreciating",
        percentChange: "+32.5%",
        volumeTrend: "decreasing",
        hotModels: [
          "Porsche 911 Carrera RS",
          "Porsche 930 Turbo",
          "Porsche 964 Carrera RS"
        ],
        marketInsights: [
          "Limited supply driving prices up",
          "Increased interest from younger collectors",
          "Original, documented examples commanding premium"
        ],
        forecast: "Continued steady appreciation expected"
      });
    },
  });
};

// Tool to fetch real-time auction results from Bring a Trailer
export const createAuctionResultsTool = () => {
  return new DynamicStructuredTool({
    name: "fetch_auction_results",
    description: "Fetch recent auction results from Bring a Trailer for a specific make and model",
    schema: z.object({
      make: z.string().describe("The manufacturer of the vehicle"),
      model: z.string().optional().describe("The model of the vehicle"),
      yearMin: z.number().optional().describe("The minimum year to filter results"),
      yearMax: z.number().optional().describe("The maximum year to filter results"),
      maxPages: z.number().optional().describe("Maximum number of pages to fetch (default: 2)"),
      generateVisualizations: z.boolean().optional().describe("Whether to generate visualizations of the results (default: false)"),
    }),
    func: async ({ make, model, yearMin, yearMax, maxPages, generateVisualizations = false }) => {
      try {
        console.log(`Fetching auction results for ${make} ${model || ''} (${yearMin || 'any'}-${yearMax || 'any'})`);
        
        // Initialize the scraper
        const scraper = new BringATrailerResultsScraper();
        
        // Scrape the results
        const results = await scraper.scrape({
          make,
          model,
          yearMin,
          yearMax,
          maxPages: maxPages || 2,
          perPage: 50
        });
        
        // Format the results for better readability
        const formattedResults = results.map(item => ({
          title: item.title,
          year: item.year,
          make: item.make,
          model: item.model,
          sold_price: item.sold_price ? `$${item.sold_price}` : 'Not sold',
          bid_amount: item.bid_amount ? `$${item.bid_amount}` : 'No bids',
          sold_date: item.sold_date,
          status: item.status,
          url: item.url,
          country: item.country,
          noreserve: item.noreserve ? 'No Reserve' : 'Reserve',
          premium: item.premium ? 'Premium' : 'Standard',
          image_url: item.image_url,
          images: item.images
        }));
        
        // Generate visualizations if requested
        let visualizations = {};
        if (generateVisualizations && results.length > 0) {
          console.log('Generating visualizations...');
          try {
            // Create the public/charts directory if it doesn't exist
            let outputPath = 'public/charts';
            
            // In production, use a path that's writable in Vercel
            if (process.env.NODE_ENV === 'production') {
              outputPath = '/tmp/charts';
            }
            
            // Generate time series chart
            const timeSeriesChartPath = await generatePriceTimeSeriesChart(results, outputPath);
            
            // Generate price histogram
            const priceHistogramPath = await generatePriceHistogram(results, outputPath);
            
            // Generate price vs. year scatter plot if we have year data
            const hasYearData = results.some(item => item.year !== undefined);
            let priceYearScatterPath = null;
            if (hasYearData) {
              priceYearScatterPath = await generatePriceYearScatterPlot(results, outputPath);
            }
            
            visualizations = {
              timeSeriesChart: timeSeriesChartPath,
              priceHistogram: priceHistogramPath,
              priceYearScatter: priceYearScatterPath
            };
            
            console.log('Visualizations generated successfully');
          } catch (error) {
            console.error('Error generating visualizations:', error);
            visualizations = {
              error: 'Failed to generate visualizations',
              details: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        }
        
        // Return a summary, visualizations (if generated), and the results
        return JSON.stringify({
          query: {
            make,
            model: model || 'Any',
            yearRange: `${yearMin || 'Any'}-${yearMax || 'Any'}`
          },
          summary: {
            totalResults: results.length,
            averageSoldPrice: calculateAverageSoldPrice(results),
            highestSoldPrice: findHighestSoldPrice(results),
            lowestSoldPrice: findLowestSoldPrice(results),
            soldPercentage: calculateSoldPercentage(results)
          },
          visualizations: generateVisualizations ? visualizations : undefined,
          results: formattedResults
        });
      } catch (error: unknown) {
        console.error('Error fetching auction results:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return JSON.stringify({
          error: 'Failed to fetch auction results',
          details: errorMessage
        });
      }
    },
  });
};

// Helper functions for the auction results tool
function calculateAverageSoldPrice(results: BaTCompletedListing[]): string {
  const soldItems = results.filter(item => item.status === 'sold' && item.sold_price);
  if (soldItems.length === 0) return 'N/A';
  
  const total = soldItems.reduce((sum: number, item: BaTCompletedListing) => sum + parseInt(item.sold_price), 0);
  return `$${Math.round(total / soldItems.length).toLocaleString()}`;
}

function findHighestSoldPrice(results: BaTCompletedListing[]): string {
  const soldItems = results.filter(item => item.status === 'sold' && item.sold_price);
  if (soldItems.length === 0) return 'N/A';
  
  const highest = Math.max(...soldItems.map(item => parseInt(item.sold_price)));
  return `$${highest.toLocaleString()}`;
}

function findLowestSoldPrice(results: BaTCompletedListing[]): string {
  const soldItems = results.filter(item => item.status === 'sold' && item.sold_price);
  if (soldItems.length === 0) return 'N/A';
  
  const lowest = Math.min(...soldItems.map(item => parseInt(item.sold_price)));
  return `$${lowest.toLocaleString()}`;
}

function calculateSoldPercentage(results: BaTCompletedListing[]): string {
  if (results.length === 0) return 'N/A';
  
  const soldItems = results.filter(item => item.status === 'sold');
  return `${Math.round((soldItems.length / results.length) * 100)}%`;
} 