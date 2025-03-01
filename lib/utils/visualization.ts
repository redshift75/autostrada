import * as vega from 'vega';
import * as vegaLite from 'vega-lite';
import { BaTCompletedListing } from '../scrapers/BringATrailerResultsScraper';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Generates a time series chart of auction prices
 * @param listings The auction listings to visualize
 * @param outputPath The path to save the visualization
 * @returns The path to the generated visualization
 */
export async function generatePriceTimeSeriesChart(
  listings: BaTCompletedListing[],
  outputPath: string = 'public/charts'
): Promise<string> {
  try {
    // Ensure the output directory exists
    if (process.env.NODE_ENV === 'production') {
      // In production, use a path that's writable in Vercel
      outputPath = path.join('/tmp', 'charts');
    }
    
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

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
        filled: true
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
          legend: null // Hide the legend
        },
        tooltip: [
          { field: 'date', type: 'temporal', title: 'Date' },
          { field: 'price', type: 'quantitative', title: 'Price' },
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

    // Generate a unique filename
    const timestamp = Date.now();
    const filename = `auction_prices_${timestamp}.svg`;
    const filePath = path.join(outputPath, filename);

    // Write the SVG to file
    fs.writeFileSync(filePath, svg);

    // Return the path to the generated file
    return filePath;
  } catch (error) {
    console.error('Error generating price time series chart:', error);
    throw error;
  }
}

/**
 * Generates a histogram of auction prices
 * @param listings The auction listings to visualize
 * @param outputPath The path to save the visualization
 * @returns The path to the generated visualization
 */
export async function generatePriceHistogram(
  listings: BaTCompletedListing[],
  outputPath: string = 'public/charts'
): Promise<string> {
  try {
    // Ensure the output directory exists
    if (process.env.NODE_ENV === 'production') {
      // In production, use a path that's writable in Vercel
      outputPath = path.join('/tmp', 'charts');
    }
    
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

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

    // Generate a unique filename
    const timestamp = Date.now();
    const filename = `price_histogram_${timestamp}.svg`;
    const filePath = path.join(outputPath, filename);

    // Write the SVG to file
    fs.writeFileSync(filePath, svg);

    // Return the path to the generated file
    return filePath;
  } catch (error) {
    console.error('Error generating price histogram:', error);
    throw error;
  }
}

/**
 * Generates a scatter plot of auction prices vs. year
 * @param listings The auction listings to visualize
 * @param outputPath The path to save the visualization
 * @returns The path to the generated visualization
 */
export async function generatePriceYearScatterPlot(
  listings: BaTCompletedListing[],
  outputPath: string = 'public/charts'
): Promise<string> {
  try {
    // Ensure the output directory exists
    if (process.env.NODE_ENV === 'production') {
      // In production, use a path that's writable in Vercel
      outputPath = path.join('/tmp', 'charts');
    }
    
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    // Filter for sold listings with valid prices and years
    const soldListings = listings.filter(
      listing => listing.status === 'sold' && 
                listing.sold_price && 
                listing.year
    );

    // Prepare data for visualization
    const data = soldListings.map(listing => ({
      year: listing.year,
      price: parseInt(listing.sold_price.replace(/[^0-9]/g, '')),
      title: listing.title,
      url: listing.url
    }));

    // Create a Vega-Lite specification
    const spec: vegaLite.TopLevelSpec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Auction Prices by Year',
      width: 800,
      height: 400,
      data: { values: data },
      mark: {
        type: 'point',
        filled: true
      },
      encoding: {
        x: {
          field: 'year',
          type: 'quantitative',
          title: 'Year',
          scale: { zero: false }
        },
        y: {
          field: 'price',
          type: 'quantitative',
          title: 'Sale Price ($)',
          scale: { zero: false }
        },
        tooltip: [
          { field: 'year', type: 'quantitative', title: 'Year' },
          { field: 'price', type: 'quantitative', title: 'Price' },
          { field: 'title', type: 'nominal', title: 'Vehicle' }
        ]
      }
    };

    // Compile the Vega-Lite specification to Vega
    const vegaSpec = vegaLite.compile(spec).spec;

    // Create a Vega view
    const view = new vega.View(vega.parse(vegaSpec), { renderer: 'none' });

    // Generate SVG
    const svg = await view.toSVG();

    // Generate a unique filename
    const timestamp = Date.now();
    const filename = `price_year_scatter_${timestamp}.svg`;
    const filePath = path.join(outputPath, filename);

    // Write the SVG to file
    fs.writeFileSync(filePath, svg);

    // Return the path to the generated file
    return filePath;
  } catch (error) {
    console.error('Error generating price-year scatter plot:', error);
    throw error;
  }
} 