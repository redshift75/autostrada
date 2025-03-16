import * as vega from 'vega';
import * as vegaLite from 'vega-lite';
import { BaTCompletedListing } from '../scrapers/BringATrailerResultsScraper';

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
 * Generates a histogram specification for any numeric data
 * @param data The data to visualize
 * @param options Configuration options for the histogram
 * @returns The Vega-Lite specification for client-side rendering
 */
export function generateHistogram<T extends Record<string, any>>(
  data: T[],
  options: {
    field: string;
    description?: string;
    title?: string;
    xAxisTitle?: string;
    yAxisTitle?: string;
    maxBins?: number;
    valueFormat?: string;
    interactive?: boolean;
    width?: number | 'container';
    height?: number;
    filter?: (item: T) => boolean;
    transform?: (item: T) => any;
    additionalFields?: string[];
    tooltipFields?: Array<{
      field?: string;
      aggregate?: 'count' | 'sum' | 'mean' | 'average' | 'median' | 'q1' | 'q3' | 'min' | 'max' | 'stdev' | 'stdevp' | 'variance' | 'variancep' | 'distinct' | 'argmin' | 'argmax';
      bin?: { maxbins: number };
      type: FieldType;
      title?: string;
      format?: string;
    }>;
  }
): vegaLite.TopLevelSpec {
  try {
    const {
      field,
      filter,
      transform,
      additionalFields = [],
      maxBins = 20,
      interactive = false,
      valueFormat,
      width = 800,
      height = 400
    } = options;

    // Filter and transform data if needed
    let filteredData = [...data]; // Create a copy to avoid modifying the original
    if (filter) {
      filteredData = filteredData.filter(filter);
    }
    
    // Process the data for visualization
    let processedData: any[] = filteredData;
    if (transform) {
      processedData = filteredData.map(item => transform(item));
    } else if (additionalFields.length > 0) {
      // If no transform function but additionalFields are specified, create a default transform
      processedData = filteredData.map(item => {
        const result: Record<string, any> = { [field]: item[field] };
        
        // Add any additional fields specified
        additionalFields.forEach(fieldName => {
          if (fieldName in item) {
            result[fieldName] = item[fieldName];
          }
        });
        
        return result;
      });
    }

    // Create mark configuration
    const mark = interactive 
      ? {
          type: 'bar' as MarkType,
          cursor: 'pointer' as CursorType
        }
      : 'bar';

    // Default tooltip fields if not provided
    const tooltipFields = options.tooltipFields || [
      { aggregate: 'count', type: 'quantitative', title: 'Count' },
      { 
        field, 
        bin: { maxbins: maxBins }, 
        type: 'quantitative', 
        title: `${field.charAt(0).toUpperCase() + field.slice(1)} Range`, 
        format: valueFormat || (field.toLowerCase() === 'price' ? '$,.0f' : ',.0f') 
      }
    ];

    // Create a Vega-Lite specification
    const spec: vegaLite.TopLevelSpec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: options.description || `${field.charAt(0).toUpperCase() + field.slice(1)} Distribution`,
      width,
      height,
      data: { values: processedData },
      autosize: {
        type: "fit",
        contains: "padding",
        resize: true
      },
      mark,
      encoding: {
        x: {
          bin: { maxbins: maxBins },
          field,
          type: 'quantitative',
          title: options.xAxisTitle || `${field.charAt(0).toUpperCase() + field.slice(1)} Range${field.toLowerCase() === 'price' ? ' ($)' : ''}`
        },
        y: {
          aggregate: 'count',
          type: 'quantitative',
          title: options.yAxisTitle || 'Number of Items'
        },
        tooltip: tooltipFields as any // Type assertion needed due to vega-lite type limitations
      }
    };

    // Add selection configuration for interactive histograms
    if (interactive) {
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
    console.error(`Error generating ${options.field} histogram:`, error);
    throw error;
  }
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

    // Common axis configuration
    const xAxis = {
      field: xField,
      type: 'quantitative' as const,
      title: config.xAxisTitle || xField.charAt(0).toUpperCase() + xField.slice(1),
      scale: { zero: false, padding: 20 },
      axis: { grid: true, format: '~s' }
    };

    const yAxis = {
      field: yField,
      type: 'quantitative' as const,
      title: config.yAxisTitle || yField.charAt(0).toUpperCase() + yField.slice(1) + (yField.toLowerCase() === 'price' ? ' ($)' : ''),
      scale: { zero: false, padding: 20 },
      axis: { grid: true, format: yField.toLowerCase() === 'price' ? '$~s' : '~s' }
    };

    // Create a Vega-Lite specification with regression line
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
      layer: [
        // Regression line layer
        {
          transform: [{
            regression: yField,
            on: xField,
            method: "linear"
          }],
          mark: {
            type: "line",
            color: "firebrick",
            strokeWidth: 1,
            strokeDash: [6, 4]
          },
          encoding: {
            x: xAxis,
            y: yAxis
          }
        },
        // Scatter plot layer
        {
          mark: {
            type: 'circle',
            size: 80,
            opacity: 0.6,
            tooltip: true,
            cursor: 'pointer',
            color: '#3b82f6'
          },
          encoding: {
            x: xAxis,
            y: yAxis,
            tooltip: tooltipFields
          }
        }
      ]
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
  
  // For layered charts
  if (spec.layer) {
    // Check if it's an array and at least one layer has encoding or mark
    const hasValidLayers = Array.isArray(spec.layer) && spec.layer.some((layer: any) => 
      (layer.encoding && typeof layer.encoding === 'object') || layer.mark !== undefined
    );
    return hasSchema && hasData && hasValidLayers;
  }
  
  // For single-layer charts
  const hasEncoding = spec.encoding && typeof spec.encoding === 'object';
  const hasMark = spec.mark !== undefined;

  return hasSchema && hasData && (hasEncoding || hasMark);
} 