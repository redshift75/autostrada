import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

// Tool to fetch auction results from Bring a Trailer
export const getAuctionResultsTool = () => {
  return new DynamicStructuredTool({
    name: "fetch_auction_results",
    description: "Fetch recent auction results from Bring a Trailer for a specific make and model. This tool queries the database for auction data including listing_id, url, title, image_url, sold_price, sold_date, bid_amount, bid_date, status, year, make, model, mileage, bidders, watchers, comments, and transmission. Use this tool to answer specific questions about auction results, price trends, vehicle specifications, and market statistics.",
    schema: z.object({
      make: z.string().describe("The manufacturer of the vehicle"),
      model: z.string().optional().describe("The model of the vehicle"),
      yearMin: z.number().optional().describe("The minimum year to filter results"),
      yearMax: z.number().optional().describe("The maximum year to filter results"),
      maxPages: z.number().optional().describe("Maximum number of pages to fetch (default: 2)"),
      maxResults: z.number().optional().describe("Maximum number of results to return (default: 100)"),
      sortBy: z.enum(["price_high_to_low", "price_low_to_high", "date_newest_first", "date_oldest_first", "mileage_lowest_first", "mileage_highest_first"]).optional().describe("How to sort the results before limiting them (default: date_newest_first)"),
      status: z.enum(["sold", "unsold", "all"]).optional().describe("Filter results by sold status (default: all)"),
    }),
    func: async ({ make, model, yearMin, yearMax, maxPages, maxResults = 100, sortBy = "date_newest_first", status = "all" }) => {
      try {
        console.log(`Fetching auction results for ${make} ${model || ''} (${yearMin || 'any'}-${yearMax || 'any'}), status: ${status}`);
        
        // Map the tool's sort options to the API's sort parameters
        let apiSortBy: string;
        let apiSortOrder: string;
        
        switch (sortBy) {
          case "price_high_to_low":
            apiSortBy = "price_sold";
            apiSortOrder = "desc";
            break;
          case "price_low_to_high":
            apiSortBy = "price_sold";
            apiSortOrder = "asc";
            break;
          case "date_newest_first":
            apiSortBy = "sold_date";
            apiSortOrder = "desc";
            break;
          case "date_oldest_first":
            apiSortBy = "sold_date";
            apiSortOrder = "asc";
            break;
          case "mileage_lowest_first":
            apiSortBy = "mileage";
            apiSortOrder = "asc";
            break;
          case "mileage_highest_first":
            apiSortBy = "mileage";
            apiSortOrder = "desc";
            break;
          default:
            apiSortBy = "sold_date";
            apiSortOrder = "desc";
        }
        
        // Ensure we have a valid base URL
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const apiUrl = new URL('/api/auction/results', baseUrl).toString();
        console.log("In tool calling fetch: ", apiUrl);
        
        // Only pass status if it's not 'all'
        const statusParam = status !== 'all' ? status : undefined;
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            make,
            model,
            yearMin,
            yearMax,
            maxPages: maxPages || 2,
            sortBy: apiSortBy,
            sortOrder: apiSortOrder,
            status: statusParam
          }),
        });
        
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        
        // Filter out results where sold_price is 'Not sold' if needed
        if (data.results && data.results.length > 0) {
          // Only filter out non-sold items for price-based sorts
          if (sortBy === "price_high_to_low" || sortBy === "price_low_to_high") {
            data.results = data.results.filter((result: any) => result.sold_price !== 'Not sold');
          }
        }
        
        // Limit the number of results to prevent context length issues
        if (data.results && data.results.length > maxResults) {
          console.log(`Limiting results from ${data.results.length} to ${maxResults}`);

          data.results = data.results.slice(0, maxResults);
          
          // Update the summary to reflect the limited results
          if (data.summary) {
            data.summary = `${data.summary} (showing ${maxResults} of ${data.results.length} results, sorted by ${sortBy})`;
          }
        }
         
        // Return a summary, and the results
        return JSON.stringify({
          query: {
            make,
            model: model || 'Any',
            yearRange: `${yearMin || 'Any'}-${yearMax || 'Any'}`,
            sortBy,
            status
          },
          summary: data.summary,
          results: data.results,
          source: data.source
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

// Tool to analyze current auction results
export const viewAuctionResultsAnalysisTool = () => {
  return new DynamicStructuredTool({
    name: "analyze_auction_results",
    description: "Analyze auction results data that the user is currently viewing",
    schema: z.object({
      analysisType: z.enum([
        "price_comparison", 
        "best_deal", 
        "sold_percentage", 
        "make_distribution", 
        "model_distribution", 
        "year_distribution", 
        "price_range", 
        "summary",
        "database_query"
      ]).describe("The type of analysis to perform"),
      query: z.string().optional().describe("The specific database query to perform (for database_query analysis type)"),
      make: z.string().optional().describe("Filter by make"),
      model: z.string().optional().describe("Filter by model"),
      yearMin: z.number().optional().describe("Filter by minimum year"),
      yearMax: z.number().optional().describe("Filter by maximum year"),
    }),
    func: async ({ analysisType, query, make, model, yearMin, yearMax }) => {
      try {
        // This function will be called with the auction results context from the agent route
        // We'll access the auction results from the global context that will be set in the agent route
        
        // @ts-ignore - This will be set in the agent route
        const auctionResults = global.currentAuctionResults || [];
        
        if (!auctionResults || auctionResults.length === 0) {
          return JSON.stringify({
            error: "No auction results available for analysis",
            message: "There are no auction results available to analyze. Please make sure you're viewing auction results."
          });
        }
        
        // Filter results based on criteria if provided
        let filteredResults = [...auctionResults];
        
        if (make) {
          filteredResults = filteredResults.filter(result => 
            result.make && result.make.toLowerCase().includes(make.toLowerCase())
          );
        }
        
        if (model) {
          filteredResults = filteredResults.filter(result => 
            result.model && result.model.toLowerCase().includes(model.toLowerCase())
          );
        }
        
        if (yearMin) {
          filteredResults = filteredResults.filter(result => result.year >= yearMin);
        }
        
        if (yearMax) {
          filteredResults = filteredResults.filter(result => result.year <= yearMax);
        }
        
        if (filteredResults.length === 0) {
          return JSON.stringify({
            error: "No auction results match the criteria",
            message: "No auction results match the specified criteria. Please try different filters."
          });
        }
        
        // Perform the requested analysis
        let result;
        
        switch (analysisType) {
          case "price_comparison":
            result = analyzeAuctionPriceComparison(filteredResults);
            break;
          case "best_deal":
            result = analyzeAuctionBestDeal(filteredResults);
            break;
          case "sold_percentage":
            result = analyzeAuctionSoldPercentage(filteredResults);
            break;
          case "make_distribution":
            result = analyzeAuctionMakeDistribution(filteredResults);
            break;
          case "model_distribution":
            result = analyzeAuctionModelDistribution(filteredResults);
            break;
          case "year_distribution":
            result = analyzeAuctionYearDistribution(filteredResults);
            break;
          case "price_range":
            result = analyzeAuctionPriceRange(filteredResults);
            break;
          case "summary":
            result = analyzeAuctionSummary(filteredResults);
            break;
          case "database_query":
            result = analyzeDatabaseQuery(filteredResults, query || "");
            break;
          default:
            result = {
              error: "Invalid analysis type",
              message: `The analysis type '${analysisType}' is not supported.`
            };
        }
        
        return JSON.stringify(result);
      } catch (error) {
        console.error("Error analyzing auction results:", error);
        return JSON.stringify({
          error: "Failed to analyze auction results",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    },
  });
};

// Tool to analyze current listings
export const viewListingsAnalysisTool = () => {
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
  const averageMileage = listings.reduce((sum: number, listing: any) => sum + listing.mileage, 0) / listings.length;
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

// Helper functions for auction results analysis

function analyzeAuctionPriceComparison(results: any[]) {
  const soldResults = results.filter(result => result.status === 'sold');
  
  if (soldResults.length === 0) {
    return {
      analysis: "No sold items found for price comparison."
    };
  }
  
  // Extract numeric prices, handling different formats
  const prices = soldResults.map(result => {
    if (typeof result.price === 'number') {
      return result.price;
    }
    
    if (result.sold_price) {
      // Handle string price format (e.g., "$12,345")
      const numericPrice = result.sold_price.toString().replace(/[^0-9.]/g, '');
      return numericPrice ? parseFloat(numericPrice) : 0;
    }
    
    return 0; // Default if no valid price found
  }).filter(price => price > 0); // Filter out zero prices
  
  if (prices.length === 0) {
    return {
      analysis: "Could not extract valid price information from the sold items."
    };
  }
  
  const lowestPrice = Math.min(...prices);
  const highestPrice = Math.max(...prices);
  const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  
  // Find the items with lowest and highest prices
  const lowestPriceItem = soldResults.find(result => {
    const price = typeof result.price === 'number' ? 
      result.price : 
      parseFloat(result.sold_price?.toString().replace(/[^0-9.]/g, '') || '0');
    return price === lowestPrice;
  }) || soldResults[0];
  
  const highestPriceItem = soldResults.find(result => {
    const price = typeof result.price === 'number' ? 
      result.price : 
      parseFloat(result.sold_price?.toString().replace(/[^0-9.]/g, '') || '0');
    return price === highestPrice;
  }) || soldResults[0];
  
  return {
    lowestPrice: {
      title: lowestPriceItem.title,
      price: `$${lowestPrice.toLocaleString()}`,
      date: lowestPriceItem.sold_date || 'Unknown',
      url: lowestPriceItem.url || null
    },
    highestPrice: {
      title: highestPriceItem.title,
      price: `$${highestPrice.toLocaleString()}`,
      date: highestPriceItem.sold_date || 'Unknown',
      url: highestPriceItem.url || null
    },
    averagePrice: `$${Math.round(averagePrice).toLocaleString()}`,
    totalSold: soldResults.length,
    analysis: `The sold prices range from $${lowestPrice.toLocaleString()} to $${highestPrice.toLocaleString()}, with an average of $${Math.round(averagePrice).toLocaleString()}. ${soldResults.length} out of ${results.length} items were sold.`
  };
}

function analyzeAuctionBestDeal(results: any[]) {
  const soldResults = results.filter(result => result.status === 'sold');
  
  if (soldResults.length === 0) {
    return {
      analysis: "No sold items found for best deal analysis.",
      bestDeals: []
    };
  }
  
  // Extract year from title for each result and get numeric price
  const resultsWithYear = soldResults.map(result => {
    const yearMatch = result.title.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? parseInt(yearMatch[0]) : null;
    
    // Get numeric price, handling different formats
    let numericPrice = 0;
    if (typeof result.price === 'number') {
      numericPrice = result.price;
    } else if (result.sold_price) {
      const priceStr = result.sold_price.toString().replace(/[^0-9.]/g, '');
      numericPrice = priceStr ? parseFloat(priceStr) : 0;
    }
    
    return { 
      ...result, 
      extractedYear: year, 
      numericPrice: numericPrice 
    };
  }).filter(result => result.extractedYear !== null && result.numericPrice > 0);
  
  if (resultsWithYear.length === 0) {
    return {
      analysis: "Could not extract valid year and price information from any sold items.",
      bestDeals: []
    };
  }
  
  // Group by year
  const groupedByYear: Record<number, any[]> = {};
  resultsWithYear.forEach(result => {
    if (!groupedByYear[result.extractedYear]) {
      groupedByYear[result.extractedYear] = [];
    }
    groupedByYear[result.extractedYear].push(result);
  });
  
  // Find the best deal in each year group (lowest price)
  const bestDeals = Object.entries(groupedByYear).map(([year, items]) => {
    const sortedByPrice = [...items].sort((a, b) => a.numericPrice - b.numericPrice);
    const bestDeal = sortedByPrice[0];
    const averagePrice = items.reduce((sum, item) => sum + item.numericPrice, 0) / items.length;
    const priceDifference = averagePrice - bestDeal.numericPrice;
    const percentageBelow = (priceDifference / averagePrice) * 100;
    
    return {
      year: parseInt(year),
      bestDeal,
      averagePrice,
      priceDifference,
      percentageBelow,
      itemCount: items.length
    };
  });
  
  // Sort by percentage below average price
  const sortedDeals = bestDeals.sort((a, b) => b.percentageBelow - a.percentageBelow);
  const topDeals = sortedDeals.slice(0, 3);
  
  if (topDeals.length === 0) {
    return {
      analysis: "Could not determine the best deals from the available data.",
      bestDeals: []
    };
  }
  
  return {
    bestDeals: topDeals.map(deal => ({
      title: deal.bestDeal.title,
      price: `$${deal.bestDeal.numericPrice.toLocaleString()}`,
      averagePrice: `$${Math.round(deal.averagePrice).toLocaleString()}`,
      percentBelow: `${Math.round(deal.percentageBelow)}%`,
      date: deal.bestDeal.sold_date || 'Unknown',
      url: deal.bestDeal.url || null
    })),
    analysis: `The best deal appears to be a ${topDeals[0].bestDeal.title} that sold for $${topDeals[0].bestDeal.numericPrice.toLocaleString()}, which is ${Math.round(topDeals[0].percentageBelow)}% below the average price of $${Math.round(topDeals[0].averagePrice).toLocaleString()} for similar vehicles from that year.`
  };
}

function analyzeAuctionSoldPercentage(results: any[]) {
  const total = results.length;
  
  if (total === 0) {
    return {
      analysis: "No auction results available for analysis.",
      overall: { total: 0, sold: 0, soldPercentage: 0 },
      byMake: []
    };
  }
  
  const sold = results.filter(result => result.status === 'sold').length;
  const soldPercentage = (sold / total) * 100;
  
  // Group by extracted make
  const makeGroups: Record<string, { total: number, sold: number }> = {};
  
  results.forEach(result => {
    let make = result.make;
    if (!make) {
      // Try to extract make from title
      const titleParts = result.title.split(' ');
      if (titleParts.length > 1) {
        make = titleParts[1]; // Assuming format is "YEAR MAKE MODEL"
      } else {
        make = 'Unknown';
      }
    }
    
    // Ensure make is a string
    make = String(make || 'Unknown');
    
    if (!makeGroups[make]) {
      makeGroups[make] = { total: 0, sold: 0 };
    }
    
    makeGroups[make].total++;
    if (result.status === 'sold') {
      makeGroups[make].sold++;
    }
  });
  
  const makeStats = Object.entries(makeGroups)
    .map(([make, stats]) => ({
      make,
      total: stats.total,
      sold: stats.sold,
      soldPercentage: stats.total > 0 ? Math.round((stats.sold / stats.total) * 100) : 0
    }))
    .sort((a, b) => b.soldPercentage - a.soldPercentage);
  
  return {
    overall: {
      total,
      sold,
      soldPercentage: Math.round(soldPercentage)
    },
    byMake: makeStats,
    analysis: `Overall, ${sold} out of ${total} auctions resulted in a sale (${Math.round(soldPercentage)}%). ${
      makeStats.length > 0 
        ? `The make with the highest sell-through rate is ${makeStats[0].make} at ${makeStats[0].soldPercentage}% (${makeStats[0].sold} out of ${makeStats[0].total}).`
        : ''
    }`
  };
}

function analyzeAuctionMakeDistribution(results: any[]) {
  if (results.length === 0) {
    return {
      makeDistribution: [],
      analysis: "No auction results available for analysis."
    };
  }
  
  const makeCount: Record<string, number> = {};
  
  results.forEach(result => {
    let make = result.make;
    if (!make) {
      // Try to extract make from title
      const titleParts = result.title.split(' ');
      if (titleParts.length > 1) {
        make = titleParts[1]; // Assuming format is "YEAR MAKE MODEL"
      } else {
        make = 'Unknown';
      }
    }
    
    // Ensure make is a string
    make = String(make || 'Unknown');
    
    if (makeCount[make]) {
      makeCount[make]++;
    } else {
      makeCount[make] = 1;
    }
  });
  
  const sortedMakes = Object.entries(makeCount)
    .sort((a, b) => b[1] - a[1])
    .map(([make, count]) => ({ make, count }));
  
  if (sortedMakes.length === 0) {
    return {
      makeDistribution: [],
      analysis: "Could not extract make information from the auction results."
    };
  }
  
  return {
    makeDistribution: sortedMakes,
    analysis: `The most common make is ${sortedMakes[0].make} with ${sortedMakes[0].count} auction results, followed by ${sortedMakes.length > 1 ? sortedMakes[1].make + ' with ' + sortedMakes[1].count + ' results' : 'no other makes'}.`
  };
}

function analyzeAuctionModelDistribution(results: any[]) {
  if (results.length === 0) {
    return {
      modelDistribution: [],
      analysis: "No auction results available for analysis."
    };
  }
  
  const modelCount: Record<string, number> = {};
  
  results.forEach(result => {
    let make = result.make;
    let model = result.model;
    
    if (!make || !model) {
      // Try to extract make and model from title
      const titleParts = result.title.split(' ');
      if (titleParts.length > 2) {
        make = make || titleParts[1]; // Assuming format is "YEAR MAKE MODEL"
        model = model || titleParts[2];
      } else {
        make = make || 'Unknown';
        model = model || 'Unknown';
      }
    }
    
    // Ensure make and model are strings
    make = String(make || 'Unknown');
    model = String(model || 'Unknown');
    
    const fullModel = `${make} ${model}`;
    
    if (modelCount[fullModel]) {
      modelCount[fullModel]++;
    } else {
      modelCount[fullModel] = 1;
    }
  });
  
  const sortedModels = Object.entries(modelCount)
    .sort((a, b) => b[1] - a[1])
    .map(([model, count]) => ({ model, count }));
  
  if (sortedModels.length === 0) {
    return {
      modelDistribution: [],
      analysis: "Could not extract model information from the auction results."
    };
  }
  
  return {
    modelDistribution: sortedModels,
    analysis: `The most common model is the ${sortedModels[0].model} with ${sortedModels[0].count} auction results, followed by ${sortedModels.length > 1 ? 'the ' + sortedModels[1].model + ' with ' + sortedModels[1].count + ' results' : 'no other models'}.`
  };
}

function analyzeAuctionYearDistribution(results: any[]) {
  if (results.length === 0) {
    return {
      analysis: "No auction results available for analysis.",
      yearDistribution: []
    };
  }
  
  const yearCount: Record<number, number> = {};
  
  results.forEach(result => {
    // Try to extract year from title if not already available
    let year: number | null = null;
    
    if (result.year && typeof result.year === 'number') {
      year = result.year;
    } else {
      const yearMatch = result.title.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        year = parseInt(yearMatch[0]);
      }
    }
    
    if (year && !isNaN(year)) {
      if (yearCount[year]) {
        yearCount[year]++;
      } else {
        yearCount[year] = 1;
      }
    }
  });
  
  const sortedYears = Object.entries(yearCount)
    .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
    .map(([year, count]) => ({ year: parseInt(year), count }));
  
  if (sortedYears.length === 0) {
    return {
      analysis: "Could not extract year information from the auction results.",
      yearDistribution: []
    };
  }
  
  const years = sortedYears.map(y => y.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  
  return {
    yearDistribution: sortedYears,
    yearRange: { min: minYear, max: maxYear },
    analysis: `The most common year is ${sortedYears[0].year} with ${sortedYears[0].count} auction results. The results span from ${minYear} to ${maxYear}.`
  };
}

function analyzeAuctionPriceRange(results: any[]) {
  const soldResults = results.filter(result => result.status === 'sold');
  
  if (soldResults.length === 0) {
    return {
      analysis: "No sold items found for price range analysis."
    };
  }
  
  // Extract numeric prices, handling different formats
  const prices = soldResults.map(result => {
    if (typeof result.price === 'number') {
      return result.price;
    }
    
    if (result.sold_price) {
      const numericPrice = result.sold_price.toString().replace(/[^0-9.]/g, '');
      return numericPrice ? parseFloat(numericPrice) : 0;
    }
    
    return 0;
  }).filter(price => price > 0);
  
  if (prices.length === 0) {
    return {
      analysis: "Could not extract valid price information from the sold items."
    };
  }
  
  const lowestPrice = Math.min(...prices);
  const highestPrice = Math.max(...prices);
  const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  
  // Create price brackets
  const range = highestPrice - lowestPrice;
  const bracketSize = range / 5;
  const brackets = Array.from({ length: 5 }, (_, i) => {
    const min = lowestPrice + (i * bracketSize);
    const max = lowestPrice + ((i + 1) * bracketSize);
    return {
      range: `$${Math.round(min).toLocaleString()} - $${Math.round(max).toLocaleString()}`,
      count: prices.filter(price => price >= min && price < max).length
    };
  });
  
  return {
    priceRange: {
      lowest: `$${lowestPrice.toLocaleString()}`,
      highest: `$${highestPrice.toLocaleString()}`,
      average: `$${Math.round(averagePrice).toLocaleString()}`
    },
    priceBrackets: brackets,
    analysis: `The sold prices range from $${lowestPrice.toLocaleString()} to $${highestPrice.toLocaleString()}, with an average price of $${Math.round(averagePrice).toLocaleString()}.`
  };
}

function analyzeAuctionSummary(results: any[]) {
  const total = results.length;
  const sold = results.filter(result => result.status === 'sold').length;
  const soldPercentage = total > 0 ? (sold / total) * 100 : 0;
  
  // Extract prices from sold items, handling different formats
  const soldPrices = results
    .filter(result => result.status === 'sold')
    .map(result => {
      if (typeof result.price === 'number') {
        return result.price;
      }
      
      if (result.sold_price) {
        const numericPrice = result.sold_price.toString().replace(/[^0-9.]/g, '');
        return numericPrice ? parseFloat(numericPrice) : 0;
      }
      
      return 0;
    })
    .filter(price => price > 0); // Filter out zero prices
  
  let priceStats = { lowest: 'N/A', highest: 'N/A', average: 'N/A' };
  
  if (soldPrices.length > 0) {
    const lowestPrice = Math.min(...soldPrices);
    const highestPrice = Math.max(...soldPrices);
    const averagePrice = soldPrices.reduce((sum, price) => sum + price, 0) / soldPrices.length;
    
    priceStats = {
      lowest: `$${lowestPrice.toLocaleString()}`,
      highest: `$${highestPrice.toLocaleString()}`,
      average: `$${Math.round(averagePrice).toLocaleString()}`
    };
  }
  
  // Analyze make distribution
  const makeAnalysis = analyzeAuctionMakeDistribution(results);
  
  // Analyze year distribution
  const yearAnalysis = analyzeAuctionYearDistribution(results);
  
  // Find best deal if there are sold items
  type BestDealType = {
    bestDeals: {
      title: string;
      price: string;
      averagePrice: string;
      percentBelow: string;
      date: string;
      url: string;
    }[];
  };
  
  let bestDealAnalysis: BestDealType = { bestDeals: [] };
  if (soldPrices.length > 0) {
    const bestDealResult = analyzeAuctionBestDeal(results);
    if (bestDealResult.bestDeals && bestDealResult.bestDeals.length > 0) {
      bestDealAnalysis = bestDealResult as BestDealType;
    }
  }
  
  return {
    totalResults: total,
    soldStats: {
      sold,
      notSold: total - sold,
      soldPercentage: Math.round(soldPercentage)
    },
    priceStats,
    topMakes: makeAnalysis.makeDistribution.slice(0, 3),
    yearRange: yearAnalysis.yearRange || { min: 'Unknown', max: 'Unknown' },
    bestDeal: bestDealAnalysis.bestDeals[0] || null,
    analysis: `There are ${total} auction results in total, with ${sold} resulting in a sale (${Math.round(soldPercentage)}%). ${
      soldPrices.length > 0 
        ? `The sold prices range from ${priceStats.lowest} to ${priceStats.highest}, with an average of ${priceStats.average}. `
        : ''
    }${
      makeAnalysis.makeDistribution.length > 0
        ? `The most common make is ${makeAnalysis.makeDistribution[0].make} with ${makeAnalysis.makeDistribution[0].count} results. `
        : ''
    }${
      yearAnalysis.yearRange
        ? `The results span from ${yearAnalysis.yearRange.min} to ${yearAnalysis.yearRange.max}. `
        : ''
    }${
      bestDealAnalysis.bestDeals.length > 0
        ? `The best deal appears to be a ${bestDealAnalysis.bestDeals[0].title} that sold for ${bestDealAnalysis.bestDeals[0].price}, which is ${bestDealAnalysis.bestDeals[0].percentBelow} below the average price for similar vehicles.`
        : ''
    }`
  };
}

// Add this function to handle database queries
function analyzeDatabaseQuery(results: any[], query: string) {
  if (!results || results.length === 0) {
    return {
      analysis: "No auction results available for database query analysis."
    };
  }

  // Process the query to determine what information is being requested
  const queryLower = query.toLowerCase();
  
  // Average price query
  if (queryLower.includes('average price') || queryLower.includes('avg price')) {
    const soldResults = results.filter(result => result.status === 'sold');
    if (soldResults.length === 0) {
      return { analysis: "No sold items found to calculate average price." };
    }
    
    const prices = soldResults.map(result => {
      if (typeof result.price === 'number') {
        return result.price;
      }
      if (result.sold_price) {
        return parseInt(result.sold_price.toString().replace(/[^0-9]/g, ''));
      }
      return 0;
    }).filter(price => price > 0);
    
    const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    return {
      analysis: `The average price is $${Math.round(averagePrice).toLocaleString()} based on ${prices.length} sold items.`,
      averagePrice: Math.round(averagePrice)
    };
  }
  
  // Highest/lowest price query
  if (queryLower.includes('highest price') || queryLower.includes('most expensive')) {
    const soldResults = results.filter(result => result.status === 'sold');
    if (soldResults.length === 0) {
      return { analysis: "No sold items found to determine highest price." };
    }
    
    const pricesWithItems = soldResults.map(result => {
      let price = 0;
      if (typeof result.price === 'number') {
        price = result.price;
      } else if (result.sold_price) {
        price = parseInt(result.sold_price.toString().replace(/[^0-9]/g, ''));
      }
      return { price, item: result };
    }).filter(item => item.price > 0);
    
    if (pricesWithItems.length === 0) {
      return { analysis: "Could not extract valid price information." };
    }
    
    const highestPriceItem = pricesWithItems.sort((a, b) => b.price - a.price)[0];
    return {
      analysis: `The highest price is $${highestPriceItem.price.toLocaleString()} for ${highestPriceItem.item.title}. URL: ${highestPriceItem.item.url}`,
      highestPrice: {
        price: highestPriceItem.price,
        title: highestPriceItem.item.title,
        url: highestPriceItem.item.url,
        year: highestPriceItem.item.year,
        make: highestPriceItem.item.make,
        model: highestPriceItem.item.model
      }
    };
  }
  
  if (queryLower.includes('lowest price') || queryLower.includes('least expensive')) {
    const soldResults = results.filter(result => result.status === 'sold');
    if (soldResults.length === 0) {
      return { analysis: "No sold items found to determine lowest price." };
    }
    
    const pricesWithItems = soldResults.map(result => {
      let price = 0;
      if (typeof result.price === 'number') {
        price = result.price;
      } else if (result.sold_price) {
        price = parseInt(result.sold_price.toString().replace(/[^0-9]/g, ''));
      }
      return { price, item: result };
    }).filter(item => item.price > 0);
    
    if (pricesWithItems.length === 0) {
      return { analysis: "Could not extract valid price information." };
    }
    
    const lowestPriceItem = pricesWithItems.sort((a, b) => a.price - b.price)[0];
    return {
      analysis: `The lowest price is $${lowestPriceItem.price.toLocaleString()} for ${lowestPriceItem.item.title}. URL: ${lowestPriceItem.item.url}`,
      lowestPrice: {
        price: lowestPriceItem.price,
        title: lowestPriceItem.item.title,
        url: lowestPriceItem.item.url,
        year: lowestPriceItem.item.year,
        make: lowestPriceItem.item.make,
        model: lowestPriceItem.item.model
      }
    };
  }
  
  // Mileage query
  if (queryLower.includes('mileage') || queryLower.includes('miles')) {
    const itemsWithMileage = results.filter(result => result.mileage && result.mileage > 0);
    if (itemsWithMileage.length === 0) {
      return { analysis: "No items found with mileage information." };
    }
    
    const averageMileage = itemsWithMileage.reduce((sum, item) => sum + item.mileage, 0) / itemsWithMileage.length;
    const lowestMileageItem = [...itemsWithMileage].sort((a, b) => a.mileage - b.mileage)[0];
    const highestMileageItem = [...itemsWithMileage].sort((a, b) => b.mileage - a.mileage)[0];
    
    return {
      analysis: `The average mileage is ${Math.round(averageMileage).toLocaleString()} miles. The lowest mileage is ${lowestMileageItem.mileage.toLocaleString()} miles (${lowestMileageItem.title}) and the highest is ${highestMileageItem.mileage.toLocaleString()} miles (${highestMileageItem.title}).`,
      mileageStats: {
        average: Math.round(averageMileage),
        lowest: {
          mileage: lowestMileageItem.mileage,
          title: lowestMileageItem.title,
          url: lowestMileageItem.url
        },
        highest: {
          mileage: highestMileageItem.mileage,
          title: highestMileageItem.title,
          url: highestMileageItem.url
        }
      }
    };
  }
  
  // Transmission query
  if (queryLower.includes('transmission')) {
    const itemsWithTransmission = results.filter(result => result.transmission);
    if (itemsWithTransmission.length === 0) {
      return { analysis: "No items found with transmission information." };
    }
    
    const transmissionCount: Record<string, number> = {};
    itemsWithTransmission.forEach(item => {
      const transmission = item.transmission.toLowerCase();
      transmissionCount[transmission] = (transmissionCount[transmission] || 0) + 1;
    });
    
    const sortedTransmissions = Object.entries(transmissionCount)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));
    
    return {
      analysis: `The most common transmission type is ${sortedTransmissions[0].type} with ${sortedTransmissions[0].count} vehicles.`,
      transmissionDistribution: sortedTransmissions
    };
  }
  
  // Default response for other queries
  return {
    analysis: `Analyzed ${results.length} auction results. Please specify what information you're looking for about these results.`,
    resultCount: results.length
  };
} 