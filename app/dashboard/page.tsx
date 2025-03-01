'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { TopLevelSpec } from 'vega-lite';

// Define types for auction results
type AuctionResult = {
  title: string;
  sold_price: string;
  bid_amount: string;
  sold_date: string;
  status: string;
  url: string;
  image_url?: string;
  make?: string;
  model?: string;
  images?: {
    small?: {
      url: string;
      width: number;
      height: number;
    };
    large?: {
      url: string;
      width: number;
      height: number;
    };
  };
  price?: number; // Add price field for filtering
};

// VegaChart component for client-side rendering
function VegaChart({ 
  spec, 
  className, 
  onSignalClick 
}: { 
  spec: TopLevelSpec, 
  className?: string,
  onSignalClick?: (name: string, value: any) => void 
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !spec) return;

    console.log('VegaChart received spec type:', typeof spec);
    console.log('VegaChart spec keys:', Object.keys(spec as any));

    // Dynamically import vega-embed to avoid SSR issues
    import('vega-embed').then(({ default: vegaEmbed }) => {
      // Ensure we're working with a proper Vega-Lite specification
      // Check if the spec is a string (which might be a data URL)
      if (typeof spec === 'string') {
        console.error('Invalid specification format: Expected Vega-Lite spec object but received string');
        try {
          // Try to parse it as JSON
          const parsedSpec = JSON.parse(spec);
          console.log('Successfully parsed string spec into object');
          
          // Continue with the parsed spec
          renderChart(parsedSpec, vegaEmbed);
        } catch (error) {
          console.error('Failed to parse string spec:', error);
          return;
        }
      } else {
        // Continue with the object spec
        renderChart(spec, vegaEmbed);
      }
    });

    function renderChart(chartSpec: any, vegaEmbed: any) {
      // Check if the spec has required Vega-Lite properties using type assertion
      const specAny = chartSpec as any;
      if (!specAny.mark && !specAny.layer && !specAny.facet && !specAny.hconcat && 
          !specAny.vconcat && !specAny.concat && !specAny.repeat) {
        console.error('Invalid Vega-Lite specification: Missing required properties', chartSpec);
        return;
      }

      // Create a deep copy of the spec to avoid modifying the original
      const specCopy = JSON.parse(JSON.stringify(chartSpec));

      // Create a modified spec with responsive width
      const responsiveSpec = {
        ...specCopy,
        width: "container", // Make width responsive to container
        height: 400, // Set a fixed height
        autosize: {
          type: "fit",
          contains: "padding",
          resize: true
        }
      };

      // Add signals for histogram selection if it's a histogram
      if (specAny.description === 'Auction Price Distribution') {
        // For Vega-Lite, we need to use a different approach for signals
        // We'll use selection instead of signals directly
        const histogramSpec = {
          ...responsiveSpec,
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

        // Safely handle the mark property
        if (typeof histogramSpec.mark === 'string') {
          // If mark is a string (e.g., 'bar'), convert it to an object
          histogramSpec.mark = {
            type: histogramSpec.mark,
            cursor: 'pointer'
          };
        } else if (typeof histogramSpec.mark === 'object') {
          // If mark is already an object, just add the cursor property
          histogramSpec.mark = {
            ...histogramSpec.mark,
            cursor: 'pointer'
          };
        } else {
          // If mark is undefined or something else, set a default
          histogramSpec.mark = {
            type: 'bar',
            cursor: 'pointer'
          };
        }

        console.log('Histogram spec mark:', histogramSpec.mark);
        console.log('Histogram spec data:', histogramSpec.data);

        vegaEmbed(containerRef.current!, histogramSpec as any, {
          actions: { export: true, source: false, compiled: false, editor: false },
          renderer: 'svg',
          mode: 'vega-lite'
        }).then((result: any) => {
          viewRef.current = result.view;
          
          // Add signal listener for histogram bar clicks
          if (onSignalClick) {
            // In Vega-Lite, the selection gets compiled to a Vega signal with a different name
            // We need to listen for the compiled signal name
            result.view.addEventListener('click', (event: any, item: any) => {
              if (item && item.datum) {
                console.log('Bar clicked:', item.datum);
                
                // Extract the bin information from the datum
                // The structure depends on how the histogram was generated
                const datum = item.datum;
                
                // Log all properties to help debug
                console.log('Datum properties:', Object.keys(datum));
                
                // Try to identify the bin properties
                const binProps = Object.keys(datum).filter(key => 
                  key.includes('bin') || 
                  key.includes('price') || 
                  key.includes('x') || 
                  key.includes('y')
                );
                
                console.log('Potential bin properties:', binProps);
                console.log('Bin values:', binProps.map(prop => `${prop}: ${datum[prop]}`));
                
                onSignalClick('barClick', datum);
              }
            });
          }
        }).catch((error: Error) => {
          console.error('Error rendering Vega chart:', error);
          console.error('Problematic spec:', JSON.stringify(histogramSpec));
        });
      } else {
        vegaEmbed(containerRef.current!, responsiveSpec as any, {
          actions: { export: true, source: false, compiled: false, editor: false },
          renderer: 'svg',
          mode: 'vega-lite'
        }).then((result: any) => {
          viewRef.current = result.view;
        }).catch((error: Error) => {
          console.error('Error rendering Vega chart:', error);
          console.error('Problematic spec:', JSON.stringify(responsiveSpec));
        });
      }
    }

    // Cleanup function
    return () => {
      if (viewRef.current) {
        viewRef.current.finalize();
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [spec, onSignalClick]);

  return <div ref={containerRef} className={className} style={{ minHeight: "400px" }} />;
}

// Create a client component that uses useSearchParams
function DashboardContent() {
  const router = useRouter();
  
  // Form state for generating new visualizations
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    yearMin: 1950,
    yearMax: 2025,
    maxPages: 2,
  });
  
  // State for auction results and loading status
  const [results, setResults] = useState<AuctionResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<AuctionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  
  // State for visualizations
  const [visualizations, setVisualizations] = useState<{
    timeSeriesChart: TopLevelSpec | null;
    priceHistogram: TopLevelSpec | null;
  } | null>(null);
  
  // State for filtered visualizations
  const [filteredVisualizations, setFilteredVisualizations] = useState<{
    timeSeriesChart: TopLevelSpec | null;
    priceHistogram: TopLevelSpec | null;
  } | null>(null);
  
  // State for active filter
  const [activeFilter, setActiveFilter] = useState<{
    min: number;
    max: number;
  } | null>(null);
  
  // State for summary
  const [summary, setSummary] = useState<any | null>(null);
  
  // State for current search
  const [currentSearch, setCurrentSearch] = useState<{
    make: string;
    model: string;
  } | null>(null);
  
  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'yearMin' || name === 'yearMax' || name === 'maxPages' ? parseInt(value) : value,
    });
  };
  
  // Format price for display
  const formatPrice = (price: string) => {
    if (!price) return 'N/A';
    
    // Remove any non-numeric characters except decimal point
    const numericPrice = price.replace(/[^0-9.]/g, '');
    
    // Convert to number and format with commas
    const formattedPrice = parseFloat(numericPrice).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    
    return formattedPrice;
  };
  
  // Handle histogram bar click
  const handleHistogramClick = (name: string, value: any) => {
    if (name === 'barClick' && value) {
      console.log('Histogram bar clicked with data:', value);
      
      // Extract the price range from the bin
      // The property names might be different based on the actual Vega-Lite spec
      let minPrice: number = 0;
      let maxPrice: number = 0;
      
      // Check for different possible property names in the datum
      if (value.bin_price !== undefined && value.bin_price_end !== undefined) {
        minPrice = value.bin_price;
        maxPrice = value.bin_price_end;
      } else if (value.bin0 !== undefined && value.bin1 !== undefined) {
        minPrice = value.bin0;
        maxPrice = value.bin1;
      } else if (value.price !== undefined) {
        // If there's a single price value, create a range around it
        const binWidth = 5000; // Approximate bin width
        minPrice = value.price - binWidth/2;
        maxPrice = value.price + binWidth/2;
      } else {
        // Try to find any properties that might contain price information
        const priceKeys = Object.keys(value).filter(key => 
          key.toLowerCase().includes('price') || 
          key.toLowerCase().includes('bin') || 
          key.toLowerCase().includes('value')
        );
        
        if (priceKeys.length >= 2) {
          // Sort the keys to get min and max
          const sortedValues = priceKeys.map(key => value[key]).sort((a, b) => a - b);
          minPrice = sortedValues[0];
          maxPrice = sortedValues[sortedValues.length - 1];
        } else if (priceKeys.length === 1) {
          // If only one price-related key, create a range around it
          const binWidth = 5000; // Approximate bin width
          minPrice = value[priceKeys[0]] - binWidth/2;
          maxPrice = value[priceKeys[0]] + binWidth/2;
        } else {
          console.error('Could not determine price range from clicked bar:', value);
          return;
        }
      }
      
      console.log(`Filtering by price range: ${minPrice} - ${maxPrice}`);
      
      // Set active filter
      setActiveFilter({ min: minPrice, max: maxPrice });
      
      // Filter results
      filterResultsByPriceRange(minPrice, maxPrice);
    }
  };
  
  // Filter results by price range
  const filterResultsByPriceRange = (minPrice: number, maxPrice: number) => {
    if (!results.length) {
      console.log('No results to filter');
      return;
    }
    
    console.log(`Filtering ${results.length} results by price range: ${minPrice} - ${maxPrice}`);
    
    // Filter results
    const filtered = results.filter(result => {
      const price = result.price;
      const isInRange = price !== undefined && price >= minPrice && price <= maxPrice;
      return isInRange;
    });
    
    console.log(`Found ${filtered.length} results in price range`);
    
    setFilteredResults(filtered);
    
    // Update time series chart with filtered data
    if (visualizations?.timeSeriesChart) {
      // Get the original data values
      const originalValues = (visualizations.timeSeriesChart.data as any).values;
      
      // Filter the values
      const filteredValues = originalValues.filter((d: any) => {
        const price = d.price || d.sold_price || d.bid_amount;
        return price >= minPrice && price <= maxPrice;
      });
      
      console.log(`Filtered time series data: ${filteredValues.length} of ${originalValues.length} points`);
      
      // Create a new spec with the filtered data
      const filteredTimeSeriesChart = {
        ...visualizations.timeSeriesChart,
        data: {
          values: filteredValues
        }
      };
      
      // Only update if we have data
      if (filteredValues.length > 0) {
        setFilteredVisualizations({
          timeSeriesChart: filteredTimeSeriesChart as TopLevelSpec,
          priceHistogram: visualizations.priceHistogram
        });
      } else {
        // If no data matches the filter, show a message instead
        setError("No data matches the selected price range. Try a different range.");
        clearFilters();
      }
    }
  };
  
  // Clear filters
  const clearFilters = () => {
    setActiveFilter(null);
    setFilteredResults([]);
    setFilteredVisualizations(null);
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults([]);
    setFilteredResults([]);
    setVisualizations(null);
    setFilteredVisualizations(null);
    setActiveFilter(null);
    setSummary(null);
    
    try {
      const response = await fetch('/api/visualizations/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('API response received');
      
      // Check if we have valid visualization specifications
      if (data.visualizations) {
        console.log('Visualization data types:', {
          timeSeriesChart: typeof data.visualizations.timeSeriesChart,
          priceHistogram: typeof data.visualizations.priceHistogram
        });
        
        // Ensure we have valid Vega-Lite specifications
        if (typeof data.visualizations.timeSeriesChart === 'string') {
          console.log('Time series chart is a string, attempting to parse');
          try {
            // Try to parse it as JSON in case it's a stringified object
            data.visualizations.timeSeriesChart = JSON.parse(data.visualizations.timeSeriesChart);
            console.log('Successfully parsed time series chart');
          } catch (e) {
            console.error('Failed to parse time series chart as JSON:', e);
            data.visualizations.timeSeriesChart = null;
          }
        }
        
        if (typeof data.visualizations.priceHistogram === 'string') {
          console.log('Price histogram is a string, attempting to parse');
          try {
            // Try to parse it as JSON in case it's a stringified object
            data.visualizations.priceHistogram = JSON.parse(data.visualizations.priceHistogram);
            console.log('Successfully parsed price histogram');
          } catch (e) {
            console.error('Failed to parse price histogram as JSON:', e);
            data.visualizations.priceHistogram = null;
          }
        }
        
        // Validate the Vega-Lite specifications
        const validateSpec = (spec: any, name: string) => {
          if (!spec) {
            console.log(`${name} spec is null or undefined`);
            return null;
          }
          
          console.log(`${name} spec type:`, typeof spec);
          console.log(`${name} spec keys:`, Object.keys(spec));
          
          // Check if it has required Vega-Lite properties
          if (!spec.mark && !spec.layer && !spec.facet && !spec.hconcat && 
              !spec.vconcat && !spec.concat && !spec.repeat) {
            console.error(`Invalid ${name} specification:`, spec);
            return null;
          }
          
          return spec;
        };
        
        data.visualizations.timeSeriesChart = validateSpec(data.visualizations.timeSeriesChart, 'time series chart');
        data.visualizations.priceHistogram = validateSpec(data.visualizations.priceHistogram, 'price histogram');
        
        console.log('Final visualization data:', {
          timeSeriesChart: data.visualizations.timeSeriesChart ? 'valid' : 'null',
          priceHistogram: data.visualizations.priceHistogram ? 'valid' : 'null'
        });
      }
      
      // Update state with results
      setResults(data.results || []);
      setVisualizations(data.visualizations || null);
      setSummary(data.summary || null);
      setCurrentSearch({
        make: formData.make,
        model: formData.model
      });
      
      // Hide the form after successful search
      setShowForm(false);
    } catch (err) {
      setError('Failed to generate visualizations. Please try again.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Auction Results Dashboard</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition duration-200"
        >
          {showForm ? 'Hide Form' : 'Generate New Visualizations'}
        </button>
      </div>
      
      {showForm && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Generate Visualizations</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="make" className="block text-sm font-medium text-gray-700 mb-1">
                  Make
                </label>
                <input
                  type="text"
                  id="make"
                  name="make"
                  value={formData.make}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">
                  Model
                </label>
                <input
                  type="text"
                  id="model"
                  name="model"
                  value={formData.model}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="yearMin" className="block text-sm font-medium text-gray-700 mb-1">
                  Year Min
                </label>
                <input
                  type="number"
                  id="yearMin"
                  name="yearMin"
                  value={formData.yearMin}
                  onChange={handleInputChange}
                  min="1900"
                  max="2025"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="yearMax" className="block text-sm font-medium text-gray-700 mb-1">
                  Year Max
                </label>
                <input
                  type="number"
                  id="yearMax"
                  name="yearMax"
                  value={formData.yearMax}
                  onChange={handleInputChange}
                  min="1900"
                  max="2025"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="maxPages" className="block text-sm font-medium text-gray-700 mb-1">
                  Max Pages to Scrape
                </label>
                <input
                  type="number"
                  id="maxPages"
                  name="maxPages"
                  value={formData.maxPages}
                  onChange={handleInputChange}
                  min="1"
                  max="20"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md transition duration-200 disabled:bg-blue-400"
                  disabled={loading}
                >
                  {loading ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}
      
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Generating visualizations and fetching results...</p>
          <p className="text-gray-500 text-sm mt-2">This may take a minute or two.</p>
        </div>
      )}
      
      {!loading && currentSearch && (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">
              {currentSearch.make} {currentSearch.model} Auction Results
              {activeFilter && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  (Filtered: {formatPrice(activeFilter.min.toString())} - {formatPrice(activeFilter.max.toString())})
                </span>
              )}
            </h2>
            
            {summary && (
              <div className="bg-blue-50 p-4 rounded-md mb-6">
                <h3 className="text-lg font-semibold mb-2">Market Summary</h3>
                <div className="text-gray-700 space-y-2">
                  {summary.totalResults && (
                    <p><strong>Total Results:</strong> {summary.totalResults}</p>
                  )}
                  {summary.averageSoldPrice && (
                    <p><strong>Average Sold Price:</strong> {formatPrice(summary.averageSoldPrice)}</p>
                  )}
                  {summary.highestSoldPrice && (
                    <p><strong>Highest Sold Price:</strong> {formatPrice(summary.highestSoldPrice)}</p>
                  )}
                  {summary.lowestSoldPrice && (
                    <p><strong>Lowest Sold Price:</strong> {formatPrice(summary.lowestSoldPrice)}</p>
                  )}
                  {summary.soldPercentage && (
                    <p><strong>Sold Percentage:</strong> {summary.soldPercentage}</p>
                  )}
                </div>
              </div>
            )}
            
            {/* Restructured layout with side-by-side charts and results */}
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Charts section */}
              <div className="lg:w-2/3 flex-shrink-0 overflow-hidden">
                {visualizations && (
                  <div className="grid grid-cols-1 gap-6 mb-4">
                    {(filteredVisualizations?.timeSeriesChart || visualizations.timeSeriesChart) && (
                      <div className="bg-gray-50 p-4 rounded-md">
                        <h3 className="text-lg font-semibold mb-2">Price Trends Over Time</h3>
                        <div className="w-full" style={{ maxWidth: '100%', minHeight: '400px' }}>
                          <VegaChart 
                            spec={filteredVisualizations?.timeSeriesChart || visualizations.timeSeriesChart!} 
                            className="w-full h-auto"
                          />
                        </div>
                      </div>
                    )}
                    
                    {visualizations.priceHistogram && (
                      <div className="bg-gray-50 p-4 rounded-md">
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="text-lg font-semibold">
                            Price Distribution
                            <span className="ml-2 text-sm font-normal text-gray-500">
                              (Click on a bar to filter)
                            </span>
                          </h3>
                          {activeFilter && (
                            <button
                              onClick={clearFilters}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm transition duration-200"
                            >
                              Clear Filter
                            </button>
                          )}
                        </div>
                        <div className="w-full" style={{ maxWidth: '100%', minHeight: '400px' }}>
                          <VegaChart 
                            spec={visualizations.priceHistogram} 
                            className="w-full h-auto"
                            onSignalClick={handleHistogramClick}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Scrollable side panel for results */}
              <div className="lg:w-1/3 flex-shrink-0">
                <div className="bg-white rounded-lg border border-gray-200 h-full">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="text-xl font-semibold">
                      Recent Auction Results
                      {activeFilter && (
                        <span className="ml-2 text-sm font-normal text-gray-500">
                          ({filteredResults.length} of {results.length})
                        </span>
                      )}
                    </h3>
                  </div>
                  <div className="overflow-y-auto" style={{ maxHeight: "calc(120vh)" }}>
                    {(activeFilter ? filteredResults : results).length === 0 ? (
                      <p className="text-gray-500 p-4">No results found.</p>
                    ) : (
                      <div className="p-4 space-y-4">
                        {(activeFilter ? filteredResults : results).map((result, index) => {
                          // Extract make and model from the title if not provided
                          const titleParts = result.title.split(' ');
                          const make = result.make || titleParts[0];
                          const model = result.model || titleParts[1];
                          
                          return (
                            <div key={index} className="border rounded-lg overflow-hidden bg-gray-50 hover:shadow-md transition-shadow duration-200">
                              <div className="p-4">
                                <div className="flex items-start space-x-4">
                                  <div className="flex-shrink-0 w-20 h-20 bg-gray-200 rounded-md overflow-hidden">
                                    <img 
                                      src={result.image_url || result.images?.small?.url || '/placeholder-car.jpg'} 
                                      alt={result.title}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-medium text-sm truncate" title={result.title}>
                                      {result.title}
                                    </h3>
                                    <div className="flex items-center mt-1">
                                      <span className={`text-sm font-semibold ${result.status === 'sold' ? 'text-green-600' : 'text-red-600'}`}>
                                        {result.status === 'sold' ? formatPrice(result.sold_price) : formatPrice(result.bid_amount)}
                                      </span>
                                      <span className="mx-2 text-gray-400">•</span>
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                                        result.status === 'sold' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                      }`}>
                                        {result.status === 'sold' ? 'Sold' : 'Not Sold'}
                                      </span>
                                    </div>
                                    {result.sold_date && (
                                      <p className="text-xs text-gray-500 mt-1">
                                        {result.sold_date}
                                      </p>
                                    )}
                                    <div className="flex items-center mt-1 space-x-2">
                                      <a 
                                        href={result.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline inline-block"
                                      >
                                        View Original
                                      </a>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {!loading && !currentSearch && !showForm && (
        <div className="text-center py-12 bg-white shadow-md rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Welcome to the Auction Results Dashboard</h2>
          <p className="text-gray-600 mb-8">Click "Generate New Visualizations" to search for auction results</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md transition duration-200"
          >
            Get Started
          </button>
        </div>
      )}
      
      <div className="mt-8">
      </div>
    </div>
  );
}

// Main dashboard component with Suspense boundary
export default function Dashboard() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
} 