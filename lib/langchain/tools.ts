import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { BringATrailerResultsScraper, BaTCompletedListing } from "../scrapers/BringATrailerResultsScraper";
import { generatePriceTimeSeriesChart, generatePriceHistogram } from "../utils/visualization";

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
          console.log('Generating visualization specifications...');
          try {
            // Generate time series chart Vega-Lite specification (not SVG)
            const timeSeriesChartSpec = await generatePriceTimeSeriesChart(results);
            
            // Generate price histogram Vega-Lite specification (not SVG)
            const priceHistogramSpec = await generatePriceHistogram(results);
            
            visualizations = {
              timeSeriesChart: timeSeriesChartSpec,
              priceHistogram: priceHistogramSpec
            };
            
            console.log('Visualization specifications generated successfully');
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

// Tool to analyze current listings
export const createListingsAnalysisTool = () => {
  return new DynamicStructuredTool({
    name: "analyze_current_listings",
    description: "Analyze the current listings being viewed by the user",
    schema: z.object({
      analysisType: z.enum([
        "price_comparison", 
        "mileage_comparison", 
        "best_value", 
        "newest", 
        "oldest", 
        "lowest_mileage", 
        "highest_mileage",
        "make_distribution",
        "model_distribution",
        "year_distribution",
        "price_range",
        "mileage_range",
        "summary"
      ]).describe("The type of analysis to perform on the listings"),
      make: z.string().optional().describe("Filter by make"),
      model: z.string().optional().describe("Filter by model"),
      yearMin: z.number().optional().describe("Filter by minimum year"),
      yearMax: z.number().optional().describe("Filter by maximum year"),
      priceMax: z.number().optional().describe("Maximum price to consider"),
      mileageMax: z.number().optional().describe("Maximum mileage to consider"),
    }),
    func: async ({ analysisType, make, model, yearMin, yearMax, priceMax, mileageMax }) => {
      try {
        // This function will be called with the listings context from the agent route
        // We'll access the listings from the global context that will be set in the agent route
        
        // @ts-ignore - This will be set in the agent route
        const listings = global.currentListings || [];
        
        if (!listings || listings.length === 0) {
          return JSON.stringify({
            error: "No listings available for analysis",
            message: "There are no listings available to analyze. Please make sure you're viewing listings."
          });
        }
        
        // Filter listings based on criteria if provided
        let filteredListings = [...listings];
        
        if (make) {
          filteredListings = filteredListings.filter(listing => 
            listing.make.toLowerCase().includes(make.toLowerCase())
          );
        }
        
        if (model) {
          filteredListings = filteredListings.filter(listing => 
            listing.model.toLowerCase().includes(model.toLowerCase())
          );
        }
        
        if (yearMin) {
          filteredListings = filteredListings.filter(listing => listing.year >= yearMin);
        }
        
        if (yearMax) {
          filteredListings = filteredListings.filter(listing => listing.year <= yearMax);
        }
        
        if (priceMax) {
          filteredListings = filteredListings.filter(listing => listing.price <= priceMax);
        }
        
        if (mileageMax) {
          filteredListings = filteredListings.filter(listing => listing.mileage <= mileageMax);
        }
        
        if (filteredListings.length === 0) {
          return JSON.stringify({
            error: "No listings match the criteria",
            message: "No listings match the specified criteria. Please try different filters."
          });
        }
        
        // Perform the requested analysis
        let result;
        
        switch (analysisType) {
          case "price_comparison":
            result = analyzePriceComparison(filteredListings);
            break;
          case "mileage_comparison":
            result = analyzeMileageComparison(filteredListings);
            break;
          case "best_value":
            result = analyzeBestValue(filteredListings);
            break;
          case "newest":
            result = analyzeNewest(filteredListings);
            break;
          case "oldest":
            result = analyzeOldest(filteredListings);
            break;
          case "lowest_mileage":
            result = analyzeLowestMileage(filteredListings);
            break;
          case "highest_mileage":
            result = analyzeHighestMileage(filteredListings);
            break;
          case "make_distribution":
            result = analyzeMakeDistribution(filteredListings);
            break;
          case "model_distribution":
            result = analyzeModelDistribution(filteredListings);
            break;
          case "year_distribution":
            result = analyzeYearDistribution(filteredListings);
            break;
          case "price_range":
            result = analyzePriceRange(filteredListings);
            break;
          case "mileage_range":
            result = analyzeMileageRange(filteredListings);
            break;
          case "summary":
            result = analyzeSummary(filteredListings);
            break;
          default:
            result = {
              error: "Invalid analysis type",
              message: "The requested analysis type is not supported."
            };
        }
        
        return JSON.stringify({
          analysisType,
          filters: {
            make: make || "Any",
            model: model || "Any",
            yearRange: `${yearMin || "Any"}-${yearMax || "Any"}`,
            priceMax: priceMax || "Any",
            mileageMax: mileageMax || "Any",
          },
          totalListings: filteredListings.length,
          result
        });
      } catch (error) {
        console.error("Error analyzing listings:", error);
        return JSON.stringify({
          error: "Analysis failed",
          message: "An error occurred while analyzing the listings.",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    },
  });
};

// Helper functions for listings analysis

function analyzePriceComparison(listings: any[]) {
  const sortedByPrice = [...listings].sort((a, b) => a.price - b.price);
  const lowestPrice = sortedByPrice[0];
  const highestPrice = sortedByPrice[sortedByPrice.length - 1];
  const averagePrice = listings.reduce((sum: number, listing: any) => sum + listing.price, 0) / listings.length;
  
  const priceRanges: {
    low: any[];
    medium: any[];
    high: any[];
  } = {
    low: [],
    medium: [],
    high: []
  };
  
  const lowThreshold = averagePrice * 0.8;
  const highThreshold = averagePrice * 1.2;
  
  listings.forEach((listing: any) => {
    if (listing.price < lowThreshold) {
      priceRanges.low.push(listing);
    } else if (listing.price > highThreshold) {
      priceRanges.high.push(listing);
    } else {
      priceRanges.medium.push(listing);
    }
  });
  
  return {
    lowestPrice: {
      year: lowestPrice.year,
      make: lowestPrice.make,
      model: lowestPrice.model,
      price: lowestPrice.price,
      mileage: lowestPrice.mileage,
      location: lowestPrice.location || 'Unknown',
      clickoffURL: lowestPrice.clickoffURL || null
    },
    highestPrice: {
      year: highestPrice.year,
      make: highestPrice.make,
      model: highestPrice.model,
      price: highestPrice.price,
      mileage: highestPrice.mileage,
      location: highestPrice.location || 'Unknown',
      clickoffURL: highestPrice.clickoffURL || null
    },
    averagePrice: Math.round(averagePrice),
    priceDistribution: {
      low: priceRanges.low.length,
      medium: priceRanges.medium.length,
      high: priceRanges.high.length
    },
    analysis: `The prices range from $${lowestPrice.price.toLocaleString()} to $${highestPrice.price.toLocaleString()}, with an average of $${Math.round(averagePrice).toLocaleString()}. ${priceRanges.low.length} listings are priced below average, ${priceRanges.medium.length} are around average, and ${priceRanges.high.length} are above average.`
  };
}

function analyzeMileageComparison(listings: any[]) {
  const sortedByMileage = [...listings].sort((a, b) => a.mileage - b.mileage);
  const lowestMileage = sortedByMileage[0];
  const highestMileage = sortedByMileage[sortedByMileage.length - 1];
  const averageMileage = listings.reduce((sum: number, listing: any) => sum + listing.mileage, 0) / listings.length;
  
  const mileageRanges: {
    low: any[];
    medium: any[];
    high: any[];
  } = {
    low: [],
    medium: [],
    high: []
  };
  
  const lowThreshold = averageMileage * 0.5;
  const highThreshold = averageMileage * 1.5;
  
  listings.forEach((listing: any) => {
    if (listing.mileage < lowThreshold) {
      mileageRanges.low.push(listing);
    } else if (listing.mileage > highThreshold) {
      mileageRanges.high.push(listing);
    } else {
      mileageRanges.medium.push(listing);
    }
  });
  
  return {
    lowestMileage: {
      year: lowestMileage.year,
      make: lowestMileage.make,
      model: lowestMileage.model,
      price: lowestMileage.price,
      mileage: lowestMileage.mileage,
      location: lowestMileage.location || 'Unknown',
      clickoffURL: lowestMileage.clickoffURL || null
    },
    highestMileage: {
      year: highestMileage.year,
      make: highestMileage.make,
      model: highestMileage.model,
      price: highestMileage.price,
      mileage: highestMileage.mileage,
      location: highestMileage.location || 'Unknown',
      clickoffURL: highestMileage.clickoffURL || null
    },
    averageMileage: Math.round(averageMileage),
    mileageDistribution: {
      low: mileageRanges.low.length,
      medium: mileageRanges.medium.length,
      high: mileageRanges.high.length
    },
    analysis: `The mileage ranges from ${lowestMileage.mileage.toLocaleString()} to ${highestMileage.mileage.toLocaleString()} miles, with an average of ${Math.round(averageMileage).toLocaleString()} miles. ${mileageRanges.low.length} listings have below average mileage, ${mileageRanges.medium.length} have around average mileage, and ${mileageRanges.high.length} have above average mileage.`
  };
}

function analyzeBestValue(listings: any[]) {
  // Calculate a value score for each listing
  // Lower score = better value (lower price, lower mileage, newer year)
  const scoredListings = listings.map(listing => {
    // Normalize values to a 0-1 scale
    const priceRange = Math.max(...listings.map(l => l.price)) - Math.min(...listings.map(l => l.price));
    const mileageRange = Math.max(...listings.map(l => l.mileage)) - Math.min(...listings.map(l => l.mileage));
    const yearRange = Math.max(...listings.map(l => l.year)) - Math.min(...listings.map(l => l.year));
    
    // Calculate normalized scores (0 = best, 1 = worst)
    const priceScore = priceRange === 0 ? 0 : (listing.price - Math.min(...listings.map(l => l.price))) / priceRange;
    const mileageScore = mileageRange === 0 ? 0 : (listing.mileage - Math.min(...listings.map(l => l.mileage))) / mileageRange;
    const yearScore = yearRange === 0 ? 0 : 1 - ((listing.year - Math.min(...listings.map(l => l.year))) / yearRange);
    
    // Weight the factors (price 50%, mileage 30%, year 20%)
    const valueScore = (priceScore * 0.5) + (mileageScore * 0.3) + (yearScore * 0.2);
    
    return {
      ...listing,
      valueScore
    };
  });
  
  // Sort by value score (lowest = best value)
  const sortedByValue = [...scoredListings].sort((a, b) => a.valueScore - b.valueScore);
  
  // Get top 3 best values
  const bestValues = sortedByValue.slice(0, 3);
  
  return {
    bestValues: bestValues.map(listing => ({
      year: listing.year,
      make: listing.make,
      model: listing.model,
      price: listing.price,
      mileage: listing.mileage,
      location: listing.location || 'Unknown',
      clickoffURL: listing.clickoffURL || null,
      valueScore: Math.round(listing.valueScore * 100) / 100
    })),
    analysis: `The best value listing is a ${bestValues[0].year} ${bestValues[0].make} ${bestValues[0].model} priced at $${bestValues[0].price.toLocaleString()} with ${bestValues[0].mileage.toLocaleString()} miles${bestValues[0].location ? ` located in ${bestValues[0].location}` : ''}${bestValues[0].clickoffURL ? `. ${bestValues[0].clickoffURL}` : ''}.`
  };
}

function analyzeNewest(listings: any[]) {
  const sortedByYear = [...listings].sort((a, b) => b.year - a.year);
  const newest = sortedByYear.slice(0, 3);
  
  return {
    newest: newest.map(listing => ({
      year: listing.year,
      make: listing.make,
      model: listing.model,
      price: listing.price,
      mileage: listing.mileage,
      location: listing.location || 'Unknown',
      clickoffURL: listing.clickoffURL || null
    })),
    analysis: `The newest listing is a ${newest[0].year} ${newest[0].make} ${newest[0].model} priced at $${newest[0].price.toLocaleString()} with ${newest[0].mileage.toLocaleString()} miles${newest[0].location ? ` located in ${newest[0].location}` : ''}${newest[0].clickoffURL ? `. ${newest[0].clickoffURL}` : ''}.`
  };
}

function analyzeOldest(listings: any[]) {
  const sortedByYear = [...listings].sort((a, b) => a.year - b.year);
  const oldest = sortedByYear.slice(0, 3);
  
  return {
    oldest: oldest.map(listing => ({
      year: listing.year,
      make: listing.make,
      model: listing.model,
      price: listing.price,
      mileage: listing.mileage,
      location: listing.location || 'Unknown',
      clickoffURL: listing.clickoffURL || null
    })),
    analysis: `The oldest listing is a ${oldest[0].year} ${oldest[0].make} ${oldest[0].model} priced at $${oldest[0].price.toLocaleString()} with ${oldest[0].mileage.toLocaleString()} miles${oldest[0].location ? ` located in ${oldest[0].location}` : ''}${oldest[0].clickoffURL ? `. ${oldest[0].clickoffURL}` : ''}.`
  };
}

function analyzeLowestMileage(listings: any[]) {
  const sortedByMileage = [...listings].sort((a, b) => a.mileage - b.mileage);
  const lowestMileage = sortedByMileage.slice(0, 3);
  
  return {
    lowestMileage: lowestMileage.map(listing => ({
      year: listing.year,
      make: listing.make,
      model: listing.model,
      price: listing.price,
      mileage: listing.mileage,
      location: listing.location || 'Unknown',
      clickoffURL: listing.clickoffURL || null
    })),
    analysis: `The lowest mileage listing is a ${lowestMileage[0].year} ${lowestMileage[0].make} ${lowestMileage[0].model} with ${lowestMileage[0].mileage.toLocaleString()} miles, priced at $${lowestMileage[0].price.toLocaleString()}${lowestMileage[0].location ? ` located in ${lowestMileage[0].location}` : ''}${lowestMileage[0].clickoffURL ? `. ${lowestMileage[0].clickoffURL}` : ''}.`
  };
}

function analyzeHighestMileage(listings: any[]) {
  const sortedByMileage = [...listings].sort((a, b) => b.mileage - a.mileage);
  const highestMileage = sortedByMileage.slice(0, 3);
  
  return {
    highestMileage: highestMileage.map(listing => ({
      year: listing.year,
      make: listing.make,
      model: listing.model,
      price: listing.price,
      mileage: listing.mileage,
      location: listing.location || 'Unknown',
      clickoffURL: listing.clickoffURL || null
    })),
    analysis: `The highest mileage listing is a ${highestMileage[0].year} ${highestMileage[0].make} ${highestMileage[0].model} with ${highestMileage[0].mileage.toLocaleString()} miles, priced at $${highestMileage[0].price.toLocaleString()}${highestMileage[0].location ? ` located in ${highestMileage[0].location}` : ''}${highestMileage[0].clickoffURL ? `. ${highestMileage[0].clickoffURL}` : ''}.`
  };
}

function analyzeMakeDistribution(listings: any[]) {
  const makeCount: Record<string, number> = {};
  
  listings.forEach((listing: any) => {
    if (makeCount[listing.make]) {
      makeCount[listing.make]++;
    } else {
      makeCount[listing.make] = 1;
    }
  });
  
  const sortedMakes = Object.entries(makeCount)
    .sort((a, b) => b[1] - a[1])
    .map(([make, count]) => ({ make, count }));
  
  return {
    makeDistribution: sortedMakes,
    analysis: `The most common make is ${sortedMakes[0].make} with ${sortedMakes[0].count} listings, followed by ${sortedMakes.length > 1 ? sortedMakes[1].make + ' with ' + sortedMakes[1].count + ' listings' : 'no other makes'}.`
  };
}

function analyzeModelDistribution(listings: any[]) {
  const modelCount: Record<string, number> = {};
  
  listings.forEach((listing: any) => {
    const fullModel = `${listing.make} ${listing.model}`;
    if (modelCount[fullModel]) {
      modelCount[fullModel]++;
    } else {
      modelCount[fullModel] = 1;
    }
  });
  
  const sortedModels = Object.entries(modelCount)
    .sort((a, b) => b[1] - a[1])
    .map(([model, count]) => ({ model, count }));
  
  return {
    modelDistribution: sortedModels,
    analysis: `The most common model is the ${sortedModels[0].model} with ${sortedModels[0].count} listings, followed by ${sortedModels.length > 1 ? 'the ' + sortedModels[1].model + ' with ' + sortedModels[1].count + ' listings' : 'no other models'}.`
  };
}

function analyzeYearDistribution(listings: any[]) {
  const yearCount: Record<number, number> = {};
  
  listings.forEach((listing: any) => {
    if (yearCount[listing.year]) {
      yearCount[listing.year]++;
    } else {
      yearCount[listing.year] = 1;
    }
  });
  
  const sortedYears = Object.entries(yearCount)
    .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
    .map(([year, count]) => ({ year: parseInt(year), count }));
  
  return {
    yearDistribution: sortedYears,
    analysis: `The most common year is ${sortedYears[0].year} with ${sortedYears[0].count} listings. The listings span from ${Math.min(...listings.map(l => l.year))} to ${Math.max(...listings.map(l => l.year))}.`
  };
}

function analyzePriceRange(listings: any[]) {
  const lowestPrice = Math.min(...listings.map((l: any) => l.price));
  const highestPrice = Math.max(...listings.map((l: any) => l.price));
  const averagePrice = listings.reduce((sum: number, listing: any) => sum + listing.price, 0) / listings.length;
  
  // Create price brackets
  const range = highestPrice - lowestPrice;
  const bracketSize = range / 5;
  const brackets = Array.from({ length: 5 }, (_, i) => {
    const min = lowestPrice + (i * bracketSize);
    const max = lowestPrice + ((i + 1) * bracketSize);
    return {
      range: `$${Math.round(min).toLocaleString()} - $${Math.round(max).toLocaleString()}`,
      count: listings.filter((l: any) => l.price >= min && l.price < max).length
    };
  });
  
  return {
    priceRange: {
      lowest: lowestPrice,
      highest: highestPrice,
      average: Math.round(averagePrice)
    },
    priceBrackets: brackets,
    analysis: `The prices range from $${lowestPrice.toLocaleString()} to $${highestPrice.toLocaleString()}, with an average price of $${Math.round(averagePrice).toLocaleString()}.`
  };
}

function analyzeMileageRange(listings: any[]) {
  const lowestMileage = Math.min(...listings.map((l: any) => l.mileage));
  const highestMileage = Math.max(...listings.map((l: any) => l.mileage));
  const averageMileage = listings.reduce((sum: number, listing: any) => sum + listing.mileage, 0) / listings.length;
  
  // Create mileage brackets
  const range = highestMileage - lowestMileage;
  const bracketSize = range / 5;
  const brackets = Array.from({ length: 5 }, (_, i) => {
    const min = lowestMileage + (i * bracketSize);
    const max = lowestMileage + ((i + 1) * bracketSize);
    return {
      range: `${Math.round(min).toLocaleString()} - ${Math.round(max).toLocaleString()} miles`,
      count: listings.filter((l: any) => l.mileage >= min && l.mileage < max).length
    };
  });
  
  return {
    mileageRange: {
      lowest: lowestMileage,
      highest: highestMileage,
      average: Math.round(averageMileage)
    },
    mileageBrackets: brackets,
    analysis: `The mileage ranges from ${lowestMileage.toLocaleString()} to ${highestMileage.toLocaleString()} miles, with an average mileage of ${Math.round(averageMileage).toLocaleString()} miles.`
  };
}

function analyzeSummary(listings: any[]) {
  const makeCount: Record<string, number> = {};
  const modelCount: Record<string, number> = {};
  const yearMin = Math.min(...listings.map((l: any) => l.year));
  const yearMax = Math.max(...listings.map((l: any) => l.year));
  const priceMin = Math.min(...listings.map((l: any) => l.price));
  const priceMax = Math.max(...listings.map((l: any) => l.price));
  const priceAvg = listings.reduce((sum: number, listing: any) => sum + listing.price, 0) / listings.length;
  const mileageMin = Math.min(...listings.map((l: any) => l.mileage));
  const mileageMax = Math.max(...listings.map((l: any) => l.mileage));
  const mileageAvg = listings.reduce((sum: number, listing: any) => sum + listing.mileage, 0) / listings.length;
  
  listings.forEach((listing: any) => {
    if (makeCount[listing.make]) {
      makeCount[listing.make]++;
    } else {
      makeCount[listing.make] = 1;
    }
    
    const fullModel = `${listing.make} ${listing.model}`;
    if (modelCount[fullModel]) {
      modelCount[fullModel]++;
    } else {
      modelCount[fullModel] = 1;
    }
  });
  
  const topMakes = Object.entries(makeCount)
    .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
    .slice(0, 3)
    .map(([make, count]) => ({ make, count }));
  
  const topModels = Object.entries(modelCount)
    .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
    .slice(0, 3)
    .map(([model, count]) => ({ model, count }));
  
  // Find best value listing
  const bestValue = analyzeBestValue(listings).bestValues[0];
  
  return {
    totalListings: listings.length,
    makeDistribution: topMakes,
    modelDistribution: topModels,
    yearRange: { min: yearMin, max: yearMax },
    priceRange: { min: priceMin, max: priceMax, avg: Math.round(priceAvg) },
    mileageRange: { min: mileageMin, max: mileageMax, avg: Math.round(mileageAvg) },
    bestValue: bestValue,
    analysis: `There are ${listings.length} listings in total, with ${topMakes.length} different makes and ${Object.keys(modelCount).length} different models. The most common make is ${topMakes[0].make} with ${topMakes[0].count} listings. The prices range from $${priceMin.toLocaleString()} to $${priceMax.toLocaleString()}, with an average of $${Math.round(priceAvg).toLocaleString()}. The mileage ranges from ${mileageMin.toLocaleString()} to ${mileageMax.toLocaleString()} miles, with an average of ${Math.round(mileageAvg).toLocaleString()} miles. The best value appears to be a ${bestValue.year} ${bestValue.make} ${bestValue.model} priced at $${bestValue.price.toLocaleString()} with ${bestValue.mileage.toLocaleString()} miles${bestValue.location ? ` located in ${bestValue.location}` : ''}${bestValue.clickoffURL ? `. ${bestValue.clickoffURL}` : ''}.`
  };
} 