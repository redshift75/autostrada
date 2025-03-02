import * as vega from 'vega';
import * as vegaLite from 'vega-lite';
import { BaTCompletedListing } from '../scrapers/BringATrailerResultsScraper';
import { Listing } from '@/components/listings/ListingCard';

/**
 * Generates a time series chart specification for auction prices
 * @param listings The auction listings to visualize
 * @returns The Vega-Lite specification for client-side rendering
 */
export async function generatePriceTimeSeriesChart(
  listings: BaTCompletedListing[]
): Promise<vegaLite.TopLevelSpec> {
  try {
    // Filter for listings with valid prices and dates (both sold and not sold)
    const validListings = listings.filter(
      listing => (listing.status === 'sold' || listing.status === 'unsold') && 
                (listing.sold_price || listing.bid_amount) && 
                listing.sold_date
    );

    // Sort by date
    validListings.sort((a, b) => {
      const dateA = new Date(a.sold_date);
      const dateB = new Date(b.sold_date);
      return dateA.getTime() - dateB.getTime();
    });

    // Prepare data for visualization
    const data = validListings.map(listing => ({
      date: listing.sold_date,
      price: parseInt((listing.status === 'sold' ? listing.sold_price : listing.bid_amount).replace(/[^0-9]/g, '')),
      title: listing.title,
      url: listing.url,
      status: listing.status
    }));

    // Create a Vega-Lite specification
    const spec: vegaLite.TopLevelSpec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Auction Price Trends',
      width: 800,
      height: 400,
      data: { values: data },
      mark: {
        type: 'point',
        size: 60,
        filled: true,
        tooltip: true
      },
      encoding: {
        x: {
          field: 'date',
          type: 'temporal',
          title: 'Sale Date'
        },
        y: {
          field: 'price',
          type: 'quantitative',
          title: 'Sale Price ($)',
          scale: { zero: false }
        },
        color: {
          field: 'status',
          type: 'nominal',
          scale: {
            domain: ['sold', 'unsold'],
            range: ['#2ca02c', '#d62728'] // Green for sold, red for not sold
          },
          legend: {
            title: 'Status',
            orient: 'top'
          }
        },
        tooltip: [
          { field: 'date', type: 'temporal', title: 'Date', format: '%b %d, %Y' },
          { field: 'price', type: 'quantitative', title: 'Price', format: '$,.0f' },
          { field: 'title', type: 'nominal', title: 'Vehicle' },
          { field: 'status', type: 'nominal', title: 'Status' }
        ]
      }
    };

    // Return the Vega-Lite specification directly
    return spec;
  } catch (error) {
    console.error('Error generating price time series chart:', error);
    throw error;
  }
}

/**
 * Generates a histogram specification for auction prices
 * @param listings The auction listings to visualize
 * @returns The Vega-Lite specification for client-side rendering
 */
export async function generatePriceHistogram(
  listings: BaTCompletedListing[]
): Promise<vegaLite.TopLevelSpec> {
  try {
    // Filter for sold listings with valid prices
    const soldListings = listings.filter(
      listing => listing.status === 'sold' && listing.sold_price
    );

    // Prepare data for visualization
    const data = soldListings.map(listing => ({
      price: parseInt(listing.sold_price.replace(/[^0-9]/g, '')),
      title: listing.title,
      url: listing.url
    }));

    // Create a Vega-Lite specification
    const spec: vegaLite.TopLevelSpec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Auction Price Distribution',
      width: 800,
      height: 400,
      data: { values: data },
      mark: 'bar',
      encoding: {
        x: {
          bin: { maxbins: 20 },
          field: 'price',
          type: 'quantitative',
          title: 'Price Range ($)'
        },
        y: {
          aggregate: 'count',
          type: 'quantitative',
          title: 'Number of Vehicles'
        },
        tooltip: [
          { bin: { maxbins: 20 }, field: 'price', type: 'quantitative', title: 'Price Range', format: '$,.0f' },
          { aggregate: 'count', type: 'quantitative', title: 'Count' }
        ]
      }
    };

    // Return the Vega-Lite specification directly
    return spec;
  } catch (error) {
    console.error('Error generating price histogram:', error);
    throw error;
  }
}

/**
 * Generates a histogram specification for listing prices
 * @param listings The car listings to visualize
 * @returns The Vega-Lite specification for client-side rendering
 */
export function generateListingPriceHistogram(
  listings: Listing[]
): vegaLite.TopLevelSpec {
  try {
    // Filter for listings with valid prices
    const validListings = listings.filter(
      listing => listing.price > 0
    );

    // Prepare data for visualization
    const data = validListings.map(listing => ({
      price: listing.price,
      title: listing.title,
      url: listing.url,
      year: listing.year,
      make: listing.make,
      model: listing.model
    }));

    // Create a Vega-Lite specification with selection support
    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Listing Price Distribution',
      width: 800,
      height: 400,
      data: { values: data },
      mark: {
        type: 'bar',
        cursor: 'pointer'
      },
      encoding: {
        x: {
          bin: { maxbins: 20 },
          field: 'price',
          type: 'quantitative',
          title: 'Price Range ($)'
        },
        y: {
          aggregate: 'count',
          type: 'quantitative',
          title: 'Number of Vehicles'
        },
        tooltip: [
          { aggregate: 'count', type: 'quantitative', title: 'Count' },
          { field: 'price', bin: { maxbins: 20 }, type: 'quantitative', title: 'Price Range', format: '$,.0f' }
        ]
      },
      // Add selection configuration to support double-click to clear
      selection: {
        barSelection: {
          type: "single",
          encodings: ["x"],
          on: "click",
          clear: "dblclick",
          resolve: "global"
        }
      }
    };

    // Return the Vega-Lite specification with type assertion
    return spec as vegaLite.TopLevelSpec;
  } catch (error) {
    console.error('Error generating listing price histogram:', error);
    throw error;
  }
}

/**
 * Generates a histogram specification for listing mileages
 * @param listings The car listings to visualize
 * @returns The Vega-Lite specification for client-side rendering
 */
export function generateListingMileageHistogram(
  listings: Listing[]
): vegaLite.TopLevelSpec {
  try {
    // Filter for listings with valid mileage
    const validListings = listings.filter(
      listing => listing.mileage > 0
    );

    // Prepare data for visualization
    const data = validListings.map(listing => ({
      mileage: listing.mileage,
      title: listing.title,
      url: listing.url,
      year: listing.year,
      make: listing.make,
      model: listing.model
    }));

    // Create a Vega-Lite specification with selection support
    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Listing Mileage Distribution',
      width: 800,
      height: 400,
      data: { values: data },
      mark: {
        type: 'bar',
        cursor: 'pointer'
      },
      encoding: {
        x: {
          bin: { maxbins: 20 },
          field: 'mileage',
          type: 'quantitative',
          title: 'Mileage Range'
        },
        y: {
          aggregate: 'count',
          type: 'quantitative',
          title: 'Number of Vehicles'
        },
        tooltip: [
          { aggregate: 'count', type: 'quantitative', title: 'Count' },
          { field: 'mileage', bin: { maxbins: 20 }, type: 'quantitative', title: 'Mileage Range', format: ',.0f' }
        ]
      },
      // Add selection configuration to support double-click to clear
      selection: {
        barSelection: {
          type: "single",
          encodings: ["x"],
          on: "click",
          clear: "dblclick",
          resolve: "global"
        }
      }
    };

    // Return the Vega-Lite specification with type assertion
    return spec as vegaLite.TopLevelSpec;
  } catch (error) {
    console.error('Error generating listing mileage histogram:', error);
    throw error;
  }
} 