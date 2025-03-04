import * as vega from 'vega';
import * as vegaLite from 'vega-lite';
import { BaTCompletedListing } from '../scrapers/BringATrailerResultsScraper';
import { Listing } from '@/components/listings/ListingCard';

// Common chart types
export type ChartType = 'timeSeries' | 'histogram' | 'scatterPlot';

// Common chart configuration interface
interface ChartConfig {
  title?: string;
  description: string;
  width?: number | 'container';
  height?: number;
  interactive?: boolean;
}

// Base chart data interface
interface ChartData {
  values: any[];
}

// Define valid mark types for TypeScript
type MarkType = 'bar' | 'point' | 'line' | 'area' | 'rect' | 'circle' | 'square' | 
                'tick' | 'rule' | 'text' | 'geoshape' | 'arc' | 'image' | 'trail';

// Define valid field types for TypeScript
type FieldType = 'quantitative' | 'temporal' | 'ordinal' | 'nominal';

// Define valid cursor types
type CursorType = 'auto' | 'default' | 'none' | 'context-menu' | 'help' | 'pointer' | 
                 'progress' | 'wait' | 'cell' | 'crosshair' | 'text' | 'vertical-text' | 
                 'alias' | 'copy' | 'move' | 'no-drop' | 'not-allowed' | 'e-resize' | 
                 'n-resize' | 'ne-resize' | 'nw-resize' | 's-resize' | 'se-resize' | 
                 'sw-resize' | 'w-resize' | 'ew-resize' | 'ns-resize' | 'nesw-resize' | 
                 'nwse-resize' | 'col-resize' | 'row-resize' | 'all-scroll' | 'zoom-in' | 
                 'zoom-out' | 'grab' | 'grabbing';


/**
 * Generates a time series chart specification for auction prices
 * @param listings The auction listings to visualize
 * @param config Optional chart configuration
 * @returns The Vega-Lite specification for client-side rendering
 */
export async function generatePriceTimeSeriesChart(
  listings: BaTCompletedListing[],
  config?: Partial<ChartConfig>
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
    const data = validListings.map(listing => {
      // Get the price value based on status
      const priceValue = listing.status === 'sold' ? listing.sold_price : listing.bid_amount;
      
      // Parse the price - handle both string and number types
      let parsedPrice = 0;
      if (typeof priceValue === 'number') {
        parsedPrice = priceValue;
      } else if (typeof priceValue === 'string') {
        parsedPrice = parseInt(priceValue.replace(/[^0-9]/g, '') || '0');
      }
      
      return {
        date: listing.sold_date,
        price: parsedPrice,
        title: listing.title,
        url: listing.url,
        mileage: listing.mileage,
        status: listing.status
      };
    });

    // Create a Vega-Lite specification
    const spec: vegaLite.TopLevelSpec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: config?.description || 'Price Trends',
      width: config?.width || 800,
      height: config?.height || 400,
      data: { values: data },
      autosize: {
        type: "fit",
        contains: "padding",
        resize: true
      },
      mark: {
        type: 'point' as const,
        size: 60,
        filled: true,
        tooltip: true,
        cursor: 'pointer' as CursorType
      },
      encoding: {
        x: {
          field: 'date',
          type: 'temporal',
          title: null,
          axis: {
            format: '%b %d %y',
            labelAngle: -45,
            grid: true,
            labelLimit: 100,
          }
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
          { field: 'status', type: 'nominal', title: 'Status' },
          { field: 'mileage', type: 'quantitative', title: 'Mileage', format: ',.0f' }
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
 * Generic function to generate a histogram specification
 * @param data The data to visualize
 * @param field The field to create histogram for
 * @param config Chart configuration options
 * @returns The Vega-Lite specification for client-side rendering
 */
export function generateHistogram(
  data: any[],
  field: string,
  config: {
    description?: string;
    title?: string;
    xAxisTitle?: string;
    yAxisTitle?: string;
    maxBins?: number;
    valueFormat?: string;
    interactive?: boolean;
    width?: number | 'container';
    height?: number;
  } = {}
): vegaLite.TopLevelSpec {
  try {
    // Create mark configuration
    const mark = config.interactive 
      ? {
          type: 'bar' as MarkType,
          cursor: 'pointer' as CursorType
        }
      : 'bar';

    // Create a Vega-Lite specification
    const spec: vegaLite.TopLevelSpec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: config.description || `${field.charAt(0).toUpperCase() + field.slice(1)} Distribution`,
      width: config.width || 800,
      height: config.height || 400,
      data: { values: data },
      autosize: {
        type: "fit",
        contains: "padding",
        resize: true
      },
      mark,
      encoding: {
        x: {
          bin: { maxbins: config.maxBins || 20 },
          field,
          type: 'quantitative',
          title: config.xAxisTitle || `${field.charAt(0).toUpperCase() + field.slice(1)} Range${field.toLowerCase() === 'price' ? ' ($)' : ''}`
        },
        y: {
          aggregate: 'count',
          type: 'quantitative',
          title: config.yAxisTitle || 'Number of Items'
        },
        tooltip: [
          { aggregate: 'count', type: 'quantitative', title: 'Count' },
          { 
            field, 
            bin: { maxbins: config.maxBins || 20 }, 
            type: 'quantitative', 
            title: `${field.charAt(0).toUpperCase() + field.slice(1)} Range`, 
            format: config.valueFormat || (field.toLowerCase() === 'price' ? '$,.0f' : ',.0f') 
          }
        ]
      }
    };

    // Add selection configuration for interactive histograms
    if (config.interactive) {
      (spec as any).selection = {
        barSelection: {
          type: "single",
          encodings: ["x"],
          on: "click",
          clear: "dblclick",
          resolve: "global"
        }
      };
    }

    return spec;
  } catch (error) {
    console.error(`Error generating ${field} histogram:`, error);
    throw error;
  }
}

/**
 * Generates a histogram specification for auction prices
 * @param listings The auction listings to visualize
 * @param config Optional chart configuration
 * @returns The Vega-Lite specification for client-side rendering
 */
export function generatePriceHistogram(
  listings: BaTCompletedListing[],
  config?: Partial<{
    description: string;
    xAxisTitle: string;
    yAxisTitle: string;
    maxBins: number;
    interactive: boolean;
    width: number | 'container';
    height: number;
  }>
): vegaLite.TopLevelSpec {
  // Filter for sold listings with valid prices
  const soldListings = listings.filter(
    listing => listing.status === 'sold' && listing.sold_price
  );

  // Prepare data for visualization
  const data = soldListings.map(listing => {
    // Parse the price - handle both string and number types
    let parsedPrice = 0;
    if (typeof listing.sold_price === 'number') {
      parsedPrice = listing.sold_price;
    } else if (typeof listing.sold_price === 'string') {
      parsedPrice = parseInt(listing.sold_price.replace(/[^0-9]/g, '') || '0');
    }
    
    return {
      price: parsedPrice,
      title: listing.title,
      url: listing.url
    };
  });

  return generateHistogram(data, 'price', {
    description: config?.description || 'Auction Price Distribution',
    xAxisTitle: config?.xAxisTitle || 'Price Range ($)',
    yAxisTitle: config?.yAxisTitle || 'Number of Vehicles',
    maxBins: config?.maxBins || 20,
    interactive: config?.interactive || false,
    width: config?.width,
    height: config?.height
  });
}

/**
 * Generates a histogram specification for listing prices
 * @param listings The car listings to visualize
 * @param config Optional chart configuration
 * @returns The Vega-Lite specification for client-side rendering
 */
export function generateListingPriceHistogram(
  listings: Listing[],
  config?: Partial<{
    description: string;
    xAxisTitle: string;
    yAxisTitle: string;
    maxBins: number;
    width: number | 'container';
    height: number;
  }>
): vegaLite.TopLevelSpec {
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

  return generateHistogram(data, 'price', {
    description: config?.description || 'Listing Price Distribution',
    xAxisTitle: config?.xAxisTitle || 'Price Range ($)',
    yAxisTitle: config?.yAxisTitle || 'Number of Vehicles',
    maxBins: config?.maxBins || 20,
    interactive: true,
    width: config?.width,
    height: config?.height
  });
}

/**
 * Generates a histogram specification for listing mileages
 * @param listings The car listings to visualize
 * @param config Optional chart configuration
 * @returns The Vega-Lite specification for client-side rendering
 */
export function generateListingMileageHistogram(
  listings: Listing[],
  config?: Partial<{
    description: string;
    xAxisTitle: string;
    yAxisTitle: string;
    maxBins: number;
    width: number | 'container';
    height: number;
  }>
): vegaLite.TopLevelSpec {
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

  return generateHistogram(data, 'mileage', {
    description: config?.description || 'Listing Mileage Distribution',
    xAxisTitle: config?.xAxisTitle || 'Mileage Range',
    yAxisTitle: config?.yAxisTitle || 'Number of Vehicles',
    maxBins: config?.maxBins || 20,
    interactive: true,
    width: config?.width,
    height: config?.height
  });
}

/**
 * Generates a scatter plot specification
 * @param data The data to visualize
 * @param xField The field for the x-axis
 * @param yField The field for the y-axis
 * @param config Chart configuration options
 * @returns The Vega-Lite specification for client-side rendering
 */
export function generateScatterPlot(
  data: any[],
  xField: string,
  yField: string,
  config: {
    description?: string;
    xAxisTitle?: string;
    yAxisTitle?: string;
    tooltipFields?: Array<{field: string, title?: string, format?: string, type?: FieldType}>;
    width?: number | 'container';
    height?: number;
  } = {}
): vegaLite.TopLevelSpec {
  try {
    // Default tooltip fields if not provided
    const tooltipFields = config.tooltipFields || [
      { field: xField, title: xField.charAt(0).toUpperCase() + xField.slice(1), format: ',.0f', type: 'quantitative' as FieldType },
      { field: yField, title: yField.charAt(0).toUpperCase() + yField.slice(1), format: yField.toLowerCase() === 'price' ? '$,.0f' : ',.0f', type: 'quantitative' as FieldType }
    ];

    // Create a Vega-Lite specification
    const spec: vegaLite.TopLevelSpec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: config.description || `${yField} vs ${xField}`,
      width: config.width || 800,
      height: config.height || 400,
      data: { values: data },
      autosize: {
        type: "fit",
        contains: "padding",
        resize: true
      },
      mark: {
        type: 'point' as MarkType,
        size: 60,
        filled: true,
        tooltip: true
      },
      encoding: {
        x: {
          field: xField,
          type: 'quantitative',
          title: config.xAxisTitle || xField.charAt(0).toUpperCase() + xField.slice(1)
        },
        y: {
          field: yField,
          type: 'quantitative',
          title: config.yAxisTitle || yField.charAt(0).toUpperCase() + yField.slice(1) + (yField.toLowerCase() === 'price' ? ' ($)' : '')
        },
        tooltip: tooltipFields
      }
    };

    return spec;
  } catch (error) {
    console.error(`Error generating scatter plot for ${yField} vs ${xField}:`, error);
    throw error;
  }
}

/**
 * Validates if an object is a valid Vega-Lite specification
 * @param spec The specification to validate
 * @returns True if valid, false otherwise
 */
export function validateVegaLiteSpec(spec: any): boolean {
  if (!spec || typeof spec !== 'object') {
    return false;
  }

  // Check for required Vega-Lite properties
  const hasSchema = spec.$schema && spec.$schema.includes('vega-lite');
  const hasData = spec.data && (spec.data.values || spec.data.url);
  const hasEncoding = spec.encoding && typeof spec.encoding === 'object';
  const hasMark = spec.mark !== undefined;

  return hasSchema && hasData && (hasEncoding || hasMark);
} 