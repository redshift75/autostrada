import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { auth } from '@clerk/nextjs/server'
// Tool to fetch auction results from Bring a Trailer
export const getAuctionResultsTool = () => {
  return new DynamicStructuredTool({
    name: "fetch_auction_results",
    description: "Fetch and analyze auction results from Bring a Trailer. " +
      "Can perform both detailed listing queries or aggregation by group. " +
      "For regular queries, returns detailed auction data. " +
      "For aggregation queries, returns grouped statistics like counts, averages, and sums. " +
      "Use aggregation to answer questions about groups of vehicles.",
    schema: z.object({
      make: z.string().optional().describe("The manufacturer of the vehicle"),
      model: z.string().optional().describe("The model of the vehicle"),
      yearMin: z.number().optional().describe("The minimum model year"),
      yearMax: z.number().optional().describe("The maximum model year"),
      normalized_color: z.string().optional().describe("The color of the vehicle"),
      sold_price: z.number().optional().describe("The sold price of the vehicle"),
      bid_amount: z.number().optional().describe("The highest bid amount of the vehicle"),
      mileage: z.number().optional().describe("The mileage of the vehicle"),
      bidders: z.number().optional().describe("The number of bidders for the vehicle"),
      watchers: z.number().optional().describe("The number of watchers for the vehicle"),
      comments: z.number().optional().describe("The number of comments for the vehicle"),
      transmission: z.enum(["manual", "automatic", "all"]).optional().describe("The transmission type of the vehicle (default: all)"),
      sold_date_min: z.string().optional().describe("The minimum sold date to filter results"),
      sold_date_max: z.string().optional().describe("The maximum sold date to filter results"),
      maxPages: z.number().optional().describe("Maximum number of pages to fetch (default: 2)"),
      maxResults: z.number().optional().describe("Maximum number of results to return (default: 10)"),
      sortBy: z.enum(["high_to_low", "low_to_high", "aggregation_high_to_low", "aggregation_low_to_high"]).optional().describe("Sort direction. Use with sortField to specify how to order results. For aggregation queries, use the aggregation options (default: low_to_high)"),
      sortField: z.string().optional().describe("Field to sort by (e.g., 'sold_price', 'sold_date', 'mileage', 'bidders'). Default is 'sold_date'"),
      status: z.enum(["sold", "unsold", "all"]).optional().describe("What sales result to filter by (default: sold)"),
      // New aggregation parameters
      groupBy: z.string().optional().describe("Field to group results by. If provided, enables aggregation mode."),
      aggregation: z.array(z.object({
        function: z.enum(["count", "avg", "sum"]).describe("The aggregation function to perform on the field"),
        field: z.string().describe("The field to perform the aggregation on.")
      })).optional().describe("The aggregation to perform on each groupBy field. Required if groupBy is provided.")
    }),
    func: async ({ 
      make, 
      model, 
      yearMin, 
      yearMax, 
      sold_date_min,
      sold_date_max,
      transmission,
      normalized_color,
      maxPages, 
      maxResults = 25, 
      sortBy = "low_to_high", 
      sortField = "sold_date",
      status = "all",
      groupBy,
      aggregation
    }) => {
      try {
        // Get the token from session
        //const { getToken } = await auth()
        //const token = await getToken()
        const token = process.env.CLERK_SECRET_KEY
        console.log(`Fetching auction results for ${make} ${model || 'Any'} (${yearMin || 'any'}-${yearMax || 'any'}), status: ${status}`);
        
        // Map the tool's sort options to the API's sort parameters
        let apiSortBy: string = sortField;
        let apiSortOrder: string = "desc";
        
        // Determine sort order based on sortBy value
        if (groupBy) {
          // Aggregation mode
          apiSortBy = "aggregation";
          apiSortOrder = sortBy === "aggregation_high_to_low" ? "desc" : "asc";
        } else {
          // Regular mode
          apiSortBy = sortField;
          apiSortOrder = sortBy === "high_to_low" ? "desc" : "asc";
        }
        
        // Ensure we have a valid base URL
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const apiUrl = new URL('/api/auction/results', baseUrl).toString();
        
        // Only pass status if it's not 'all'
        const statusParam = status !== 'all' ? status : 'sold';

        // Prepare request body based on whether we're doing aggregation or not
        const body = JSON.stringify(groupBy && aggregation ? {
          // Aggregation mode
          make,
          model,
          yearMin,
          yearMax,
          sold_date_min,
          sold_date_max,
          status: statusParam,
          transmission,
          normalized_color,
          groupBy,
          aggregation,
          sortBy: apiSortBy,
          sortOrder: apiSortOrder
        } : {
          // Regular mode
          make,
          model,
          yearMin,
          yearMax,
          sold_date_min,
          sold_date_max,
          transmission,
          normalized_color,
          maxPages: maxPages || 2,
          sortBy: apiSortBy,
          sortOrder: apiSortOrder,
          status: statusParam
        });
        
        console.log(`Body: ${body}`);

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: body,
        });
        
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        
        // Handle aggregation results differently
        if (groupBy && aggregation) {
          return JSON.stringify({
            query: {
              make,
              model: model || 'Any',
              yearRange: `${yearMin || 'Any'}-${yearMax || 'Any'}`,
              soldDateRange: `${sold_date_min || 'Any'}-${sold_date_max || 'Any'}`,
              groupBy,
              aggregation
            },
            results: data.results,
            filters: data.filters
          });
        }
        
        // Regular results processing
        if (data.results && data.results.length > 0) {
          // Only filter out non-sold items for price-based sorts
          if (sortBy === "high_to_low" || sortBy === "low_to_high") {
            data.results = data.results.filter((result: any) => result.sold_price !== '');
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
            soldDateRange: `${sold_date_min || 'Any'}-${sold_date_max || 'Any'}`,
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
export const auctionResultsAnalysisTool = () => {
  return new DynamicStructuredTool({
    name: "analyze_auction_results",
    description: "Analyze auction results data that the user is currently viewing",
    schema: z.object({
      analysisType: z.enum([
        "best_deal", 
        "summary"
      ]).describe("The type of analysis to perform")
    }),
    func: async ({ analysisType }) => {
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
        
        // Perform the requested analysis
        let result;
        
        switch (analysisType) {
          case "best_deal":
            result = analyzeAuctionBestDeal(auctionResults);
            break;
          case "summary":
            result = analyzeAuctionSummary(auctionResults);
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
       "best_value", 
       "summary"
      ]).describe("The type of analysis to perform on the listings")
    }),
    func: async ({ analysisType }) => {
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
        
        // Perform the requested analysis
        let result;
        
        switch (analysisType) {
         case "best_value":
            result = analyzeListingBestValue(listings);
            break;
          case "summary":
            result = analyzeListingSummary(listings);
            break;
          default:
            result = {
              error: "Invalid analysis type",
              message: "The requested analysis type is not supported."
            };
        }
        
        return JSON.stringify({
          analysisType,
          totalListings: listings.length,
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
function analyzeListingBestValue(listings: any[]) {
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

function analyzeListingSummary(listings: any[]) {
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
  const bestValue = analyzeListingBestValue(listings).bestValues[0];
  
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
    bestDeal: bestDealAnalysis.bestDeals[0] || null,
    analysis: `There are ${total} auction results in total, with ${sold} resulting in a sale (${Math.round(soldPercentage)}%). ${
      soldPrices.length > 0 
        ? `The sold prices range from ${priceStats.lowest} to ${priceStats.highest}, with an average of ${priceStats.average}. `
        : ''
    }${
      bestDealAnalysis.bestDeals.length > 0
        ? `The best deal appears to be a ${bestDealAnalysis.bestDeals[0].title} that sold for ${bestDealAnalysis.bestDeals[0].price}, which is ${bestDealAnalysis.bestDeals[0].percentBelow} below the average price for similar vehicles.`
        : ''
    }`
  };
}