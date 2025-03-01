import * as vega from 'vega';
import * as vegaLite from 'vega-lite';
import { BaTCompletedListing } from '../scrapers/BringATrailerResultsScraper';

/**
 * Generates a time series chart of auction prices
 * @param listings The auction listings to visualize
 * @returns The SVG string of the generated visualization
 */
export async function generatePriceTimeSeriesChart(
  listings: BaTCompletedListing[]
): Promise<string> {
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
          legend: null
        },
        tooltip: [
          { field: 'date', type: 'temporal', title: 'Date', format: '%b %d, %Y' },
          { field: 'price', type: 'quantitative', title: 'Price', format: '$,.0f' },
          { field: 'title', type: 'nominal', title: 'Vehicle' },
          { field: 'status', type: 'nominal', title: 'Status' }
        ]
      }
    };

    // Compile the Vega-Lite specification to Vega
    const vegaSpec = vegaLite.compile(spec).spec;

    // Create a Vega view
    const view = new vega.View(vega.parse(vegaSpec), { renderer: 'none' });

    // Generate SVG
    const svg = await view.toSVG();

    // Add custom tooltip attributes to the SVG
    const enhancedSvg = svg.replace(/<circle/g, '<circle data-tooltip-enabled="true"');

    // Return the SVG string directly
    return enhancedSvg;
  } catch (error) {
    console.error('Error generating price time series chart:', error);
    throw error;
  }
}

/**
 * Generates a histogram of auction prices
 * @param listings The auction listings to visualize
 * @returns The SVG string of the generated visualization
 */
export async function generatePriceHistogram(
  listings: BaTCompletedListing[]
): Promise<string> {
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
          { bin: { maxbins: 20 }, field: 'price', type: 'quantitative', title: 'Price Range' },
          { aggregate: 'count', type: 'quantitative', title: 'Count' }
        ]
      }
    };

    // Compile the Vega-Lite specification to Vega
    const vegaSpec = vegaLite.compile(spec).spec;

    // Create a Vega view
    const view = new vega.View(vega.parse(vegaSpec), { renderer: 'none' });

    // Generate SVG
    const svg = await view.toSVG();

    // Return the SVG string directly
    return svg;
  } catch (error) {
    console.error('Error generating price histogram:', error);
    throw error;
  }
} 