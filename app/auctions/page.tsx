'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { TopLevelSpec } from 'vega-lite';
import AuctionAIAgent from '../../components/agent/AuctionAIAgent';
// Import the shared VegaChart component
import VegaChart from '@/components/shared/VegaChart';
// Import utility functions
import { formatPrice } from '@/lib/utils/index';
import { validateVegaLiteSpec } from '@/lib/utils/visualization';
import { isNumber } from 'util';

// Define types for car data from Supabase
type CarMake = {
  make: string;
};

type CarModel = {
  model: string;
};

// Define types for auction results
type AuctionResult = {
  title: string;
  sold_price: string;
  bid_amount: string;
  end_date: string;
  status: string;
  url: string;
  image_url?: string;
  make?: string;
  model?: string;
  mileage?: number;
  bidders?: number;
  watchers?: number;
  comments?: number;
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
  transmission?: string; // Add transmission field
  [key: string]: any; // Add index signature to allow string indexing
};

// Create a client component that uses useSearchParams
function AuctionsContent() {
  const router = useRouter();
  
  // Form state
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    yearMin: 1950,
    yearMax: 2025,
    maxPages: 2,
    transmission: 'Any',
  });
  
  // Add state for makes
  const [makes, setMakes] = useState<string[]>([]);
  const [loadingMakes, setLoadingMakes] = useState(true);
  
  // Form refs for uncontrolled inputs
  const makeInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const yearMinInputRef = useRef<HTMLInputElement>(null);
  const yearMaxInputRef = useRef<HTMLInputElement>(null);
  
  // State for database connection
  const [dbConnectionError, setDbConnectionError] = useState(false);
  
  // State for auction results and loading status
  const [results, setResults] = useState<AuctionResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<AuctionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('Loading...');
  const [error, setError] = useState<string | null>(null);
  
  // State for visualizations
  const [visualizations, setVisualizations] = useState<{
    timeSeriesChart: TopLevelSpec | null;
    priceHistogram: TopLevelSpec | null;
    priceMileageScatter: TopLevelSpec | null;
  } | null>(null);
  
  // State for filtered visualizations
  const [filteredVisualizations, setFilteredVisualizations] = useState<{
    timeSeriesChart: TopLevelSpec | null;
    priceHistogram: TopLevelSpec | null;
    priceMileageScatter: TopLevelSpec | null;
  } | null>(null);
  
  // State for active filter
  const [activeFilter, setActiveFilter] = useState<{
    min: number;
    max: number;
  } | null>(null);
  
  // State for summary
  const [summary, setSummary] = useState<any>(null);
  
  // State for current search
  const [currentSearch, setCurrentSearch] = useState<{
    make: string;
    model: string;
  } | null>(null);
  
  // State for data source
  const [dataSource, setDataSource] = useState<string | null>(null);
  
  // State for AI-generated results
  const [aiResults, setAiResults] = useState<AuctionResult[]>([]);
  const [showAiResults, setShowAiResults] = useState(false);
  
  // Add useEffect to fetch makes on mount
  useEffect(() => {
    const fetchMakes = async () => {
      try {
        const response = await fetch('/api/cars?type=makes');
        
        if (response.status === 503) {
          setDbConnectionError(true);
          setLoadingMakes(false);
          return;
        }
        
        if (!response.ok) {
          console.error('Makes API error:', response.status, response.statusText);
          setLoadingMakes(false);
          return;
        }
        
        const data = await response.json();
        
        if (!data || !Array.isArray(data)) {
          console.error('Invalid makes data format:', data);
          setLoadingMakes(false);
          return;
        }
        
        // Get unique makes using Set to remove duplicates
        const uniqueMakes = Array.from(new Set(data.map((item: CarMake) => item.make)))
          .filter((make): make is string => !!make)
          .sort();
        
        setMakes(uniqueMakes);
        setLoadingMakes(false);
      } catch (error) {
        console.error('Error fetching makes:', error);
        setLoadingMakes(false);
      }
    };
    
    fetchMakes();
  }, []);
  
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
  
  // Handle time series chart point click
  const handleTimeSeriesClick = (name: string, value: any) => {
    if (name === 'pointClick' && value) {
      console.log('Time series point clicked with data:', value);
      
      // Check if the point has a URL
      if (value.url) {
        console.log('Opening URL:', value.url);
        // Open the URL in a new tab
        window.open(value.url, '_blank');
      } else {
        console.log('No URL found for this point');
      }
    }
  };
  
  // Filter results by price range
  const filterResultsByPriceRange = (minPrice: number, maxPrice: number) => {
    if (results.length === 0) return;
    
    // Filter results by price range
    const filtered = results.filter(result => {
      const price = result.price || 0;
      return price >= minPrice && price <= maxPrice;
    });
    
    if (filtered.length > 0) {
      // Set filtered results
      setFilteredResults(filtered);
      
      // Set active filter
      setActiveFilter({ min: minPrice, max: maxPrice });
      
      // Filter visualizations
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

        // Filter price vs mileage scatter plot data
        let filteredPriceMileageScatter = null;
        if (visualizations.priceMileageScatter) {
          const originalScatterValues = (visualizations.priceMileageScatter.data as any).values;
          const filteredScatterValues = originalScatterValues.filter((d: any) => {
            const price = d.sold_price || d.price || 0;
            return price >= minPrice && price <= maxPrice;
          });

          filteredPriceMileageScatter = {
            ...visualizations.priceMileageScatter,
            data: {
              values: filteredScatterValues
            }
          };
        }
        
        // Only update if we have data
        if (filteredValues.length > 0) {
          setFilteredVisualizations({
            timeSeriesChart: filteredTimeSeriesChart as TopLevelSpec,
            priceHistogram: visualizations.priceHistogram,
            priceMileageScatter: filteredPriceMileageScatter as TopLevelSpec
          });
        } else {
          // If no data matches the filter, show a message instead
          setError("No data matches the selected price range. Try a different range.");
          clearFilters();
        }
      }
    } else {
      // If no data matches the filter, show a message instead
      setError("No data matches the selected price range. Try a different range.");
      clearFilters();
    }
  };
  
  // Clear filters
  const clearFilters = () => {
    setActiveFilter(null);
    setFilteredResults([]);
    setFilteredVisualizations({
      timeSeriesChart: null,
      priceHistogram: null,
      priceMileageScatter: null
    });
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Get values from refs
    const make = makeInputRef.current?.value || '';
    const model = modelInputRef.current?.value || '';
    const yearMin = parseInt(yearMinInputRef.current?.value || '1950');
    const yearMax = parseInt(yearMaxInputRef.current?.value || '2025');
    
    // Validate required fields
    if (!make) {
      setError('Make is required field');
      return;
    }
    
    // Create submission data
    const submissionData = {
      make,
      model,
      yearMin,
      yearMax,
      maxPages: formData.maxPages,
      transmission: formData.transmission, // Keep transmission as string
    };
    
    // Update form data state
    setFormData(submissionData);
    
    setLoading(true);
    setLoadingMessage('Checking database for results...');
    setError(null);
    setResults([]);
    setFilteredResults([]);
    setVisualizations(null);
    setFilteredVisualizations(null);
    setActiveFilter(null);
    setSummary(null);
    setDataSource(null);
    
    try {
      // Set a timeout to update the loading message after 2 seconds
      // This assumes that if Supabase doesn't have results, we'll fall back to the scraper
      const messageTimeout = setTimeout(() => {
        setLoadingMessage('No results found in database. Fetching fresh data from Bring a Trailer...');
      }, 3000);
      
      // Prepare API request data
      const apiRequestData = {
        ...submissionData,
        transmission: formData.transmission !== 'Any' ? formData.transmission : undefined,
      };
      
      // Step 1: Fetch auction results
      const resultsResponse = await fetch('/api/auction/results', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiRequestData),
      });
      
      // Clear the timeout
      clearTimeout(messageTimeout);
      
      if (!resultsResponse.ok) {
        const errorData = await resultsResponse.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Error: ${resultsResponse.status}`);
      }
      
      const resultsData = await resultsResponse.json();
      
      // Update loading message for visualization generation
      setLoadingMessage('Generating visualizations...');
      
      // Step 2: Generate visualizations
      const visualizationsResponse = await fetch('/api/visualizations/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          results: resultsData.results,
          summary: resultsData.summary,
          source: resultsData.source
        }),
      });
      
      if (!visualizationsResponse.ok) {
        const errorData = await visualizationsResponse.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Error: ${visualizationsResponse.status}`);
      }
      
      const data = await visualizationsResponse.json();
      console.log('API response received');
      
      // Check if we have valid visualization specifications and results
      if (data.visualizations && data.results.length > 0) {
        console.log('Visualization data types:', {
          timeSeriesChart: typeof data.visualizations.timeSeriesChart,
          priceHistogram: typeof data.visualizations.priceHistogram,
          priceMileageScatter: typeof data.visualizations.priceMileageScatter
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

        if (typeof data.visualizations.priceMileageScatter === 'string') {
          console.log('Price vs mileage scatter is a string, attempting to parse');
          try {
            data.visualizations.priceMileageScatter = JSON.parse(data.visualizations.priceMileageScatter);
            console.log('Successfully parsed price vs mileage scatter');
          } catch (e) {
            console.error('Failed to parse price vs mileage scatter as JSON:', e);
            data.visualizations.priceMileageScatter = null;
          }
        }
        
        // Add 90-day moving average to time series chart
        if (data.visualizations.timeSeriesChart) {
          // Convert to a layered chart if it's not already
          if (!data.visualizations.timeSeriesChart.layer) {
            const originalSpec = { ...data.visualizations.timeSeriesChart };
            
            // Create a layered chart with the original chart as the first layer
            data.visualizations.timeSeriesChart = {
              ...originalSpec,
              layer: [
                // Original scatter plot or line chart
                {
                  mark: originalSpec.mark,
                  encoding: originalSpec.encoding
                },
                // Moving average line
                {
                  mark: {
                    type: "line",
                    color: "blue",
                    strokeWidth: 2
                  },
                  transform: [
                    {
                      window: [
                        {
                          op: "mean",
                          field: "price",
                          as: "moving_avg"
                        }
                      ],
                      frame: [-90, 0], // 90-day window (45 days before and after)
                      sort: [{ field: "date", order: "ascending" }]
                    }
                  ],
                  encoding: {
                    x: { field: "date", type: "temporal",
                      title: null,
                      axis: {
                        format: '%b %d %y',
                        labelAngle: -45,
                        grid: true,
                        labelLimit: 100,
                        title: null
                      },
                      scale: {
                        padding: 10
                      }},
                    y: { field: "moving_avg", type: "quantitative" }
                  }
                }
              ]
            };
            
            // Remove the mark and encoding from the top level since they're now in the layers
            delete data.visualizations.timeSeriesChart.mark;
            delete data.visualizations.timeSeriesChart.encoding;            
          }
        }
      }
      
      // Update state with results
      setResults(data.results || []);
      setVisualizations(data.visualizations || null);
      setSummary(data.summary || null);
      setDataSource(data.source || 'scraper');
      setCurrentSearch({
        make,
        model
      });
      
      // Set a helpful error message if there are no results
      if (!data.results || data.results.length === 0) {
        console.log('No results found for the search criteria');
        // We don't set an error here because we want to show the "No results found" UI
        // instead of the error UI
      }
    } catch (err) {
      setError('Failed to generate visualizations. Please try again.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
      setLoadingMessage('Loading...'); // Reset loading message
    }
  };
  
  // Handle AI results
  const handleAIResultsChange = (results: AuctionResult[]) => {
    if (results && results.length > 0) {
      setAiResults(results);
      setShowAiResults(true);
    }
  };
  
  // Helper function to determine if results are aggregated data
  const isAggregateData = (results: AuctionResult[]): boolean => {
    // Check if results appear to be summary/aggregate data rather than individual listings
    // This can be determined by checking if important listing attributes are missing
    if (results.length === 0) return false;
    
    // If most records are missing key auction data, it's likely aggregate data
    const missingDataCount = results.filter(item => 
      (!item.title || item.title === '') ||
      (!item.sold_price && !item.bid_amount) ||
      (!item.url || item.url === '')
    ).length;
    
    // If more than half the results are missing key data, treat as aggregate
    return missingDataCount > results.length / 2;
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Auction Results
            </h1>
            <p className="mt-2 text-lg text-gray-500">
              Analyze Historical Auction Results
            </p>
          </div>
        </div>
        
        {/* Search Form */}
        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Search Auction Results</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="flex flex-col relative">
                <label htmlFor="make" className="mb-1 font-medium">
                  Make <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="make"
                  name="make"
                  ref={makeInputRef}
                  list="makes-list"
                  defaultValue=""
                  onChange={(e) => {
                    if (modelInputRef.current) {
                      modelInputRef.current.value = '';
                    }
                  }}
                  className="border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
                  placeholder={loadingMakes ? 'Loading makes...' : 'Start typing to select a make'}
                  required
                />
                <datalist id="makes-list">
                  {makes.map((make) => (
                    <option key={make} value={make} />
                  ))}
                </datalist>
                {dbConnectionError && (
                  <p className="mt-1 text-sm text-red-500">
                    Database connection error. Some makes may not be available.
                  </p>
                )}
              </div>
              
              <div className="flex flex-col relative">
                <label htmlFor="model" className="mb-1 font-medium">
                  Model
                </label>
                <input
                  type="text"
                  id="model"
                  name="model"
                  ref={modelInputRef}
                  onClick={(e) => e.stopPropagation()}
                  className="border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
                  autoComplete="off"
                  placeholder={loadingMakes ? "Loading makes..." : (makeInputRef.current?.value ? `Enter ${makeInputRef.current.value} model...` : "First select a make...")}
                />
              </div>
              
              <div className="flex flex-col">
                <label htmlFor="yearMin" className="mb-1 font-medium">
                  Year (Min)
                </label>
                <input
                  type="number"
                  id="yearMin"
                  name="yearMin"
                  ref={yearMinInputRef}
                  defaultValue={formData.yearMin}
                  className="border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
                  placeholder="e.g. 1950"
                  min="1900"
                  max="2025"
                />
              </div>
              
              <div className="flex flex-col">
                <label htmlFor="yearMax" className="mb-1 font-medium">
                  Year (Max)
                </label>
                <input
                  type="number"
                  id="yearMax"
                  name="yearMax"
                  ref={yearMaxInputRef}
                  defaultValue={formData.yearMax}
                  className="border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
                  placeholder="e.g. 2025"
                  min="1950"
                  max="2025"
                />
              </div>
              <div className="flex flex-col">
                <label htmlFor="transmission" className="mb-1 font-medium">
                  Transmission
                </label>
                <select
                  id="transmission"
                  name="transmission"
                  value={formData.transmission}
                  onChange={(e) => setFormData(prev => ({ ...prev, transmission: e.target.value }))}
                  className="border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="Any">Any</option>
                  <option value="Automatic">Automatic</option>
                  <option value="Manual">Manual</option>
                </select>
              </div>
              <div className="md:col-span-2 lg:col-span-5 flex justify-end">
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition-colors"
                  disabled={loading}
                >
                  {loading ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </div>
          </form>
        </div>
        
        {/* Results Section */}
        {loading ? (
          <div className="flex flex-col justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-600">{loadingMessage}</p>
          </div>
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        ) : results && results.length > 0 ? (
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">
                {currentSearch?.make} {currentSearch?.model} Auction Results
                {activeFilter && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    (Filtered: {formatPrice(activeFilter.min.toString())} - {formatPrice(activeFilter.max.toString())})
                  </span>
                )}
              </h2>
              
              {/* Data Source Indicator */}
              <div className="mb-4 text-sm text-gray-600">
                Data source: <span className="font-semibold">{dataSource === 'supabase' ? 'Database' : 'Live Scraper'}</span>
                {dataSource === 'supabase' && (
                  <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Faster response</span>
                )}
                {dataSource === 'scraper' && (
                  <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">Fresh data</span>
                )}
              </div>
              
              {summary && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
                  <h2 className="text-xl font-semibold mb-4">Market Summary</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Total Results</p>
                      <p className="text-2xl font-bold">{summary.totalResults}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Average Sold Price</p>
                      <p className="text-2xl font-bold">{formatPrice(summary.averageSoldPrice)}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Highest Sold Price</p>
                      <p className="text-2xl font-bold">{formatPrice(summary.highestSoldPrice)}</p>
                    </div>                    
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Avg Mileage</p>
                      <p className="text-2xl font-bold">{summary.averageMileage}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Sold Percentage</p>
                      <p className="text-2xl font-bold">{summary.soldPercentage}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Restructured layout with side-by-side charts and results */}
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Charts section */}
                <div className="lg:w-2/3 flex-shrink-0 overflow-hidden">
                  {visualizations ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
                      <div className="lg:col-span-2">
                        {(filteredVisualizations?.timeSeriesChart || visualizations.timeSeriesChart) ? (
                          <div className="bg-gray-50 p-4 rounded-md">
                            <h3 className="text-lg font-semibold mb-2">
                              Price Trends
                              <span className="ml-2 text-sm font-normal text-gray-500">
                                (Click to view listing)
                              </span>
                            </h3>
                            <div className="w-full" style={{ maxWidth: '100%', minHeight: '400px' }}>
                              <VegaChart 
                                spec={filteredVisualizations?.timeSeriesChart || visualizations.timeSeriesChart!} 
                                className="w-full h-auto"
                                onSignalClick={handleTimeSeriesClick}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="bg-gray-50 p-4 rounded-md">
                            <h3 className="text-lg font-semibold mb-2">Price Trends</h3>
                            <div className="w-full flex items-center justify-center" style={{ minHeight: '200px' }}>
                              <div className="text-center p-6">
                                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <h3 className="mt-2 text-sm font-medium text-gray-900">No price trend data available</h3>
                                <p className="mt-1 text-sm text-gray-500">
                                  We couldn't generate a price trend chart for this search. This may be because there are too few results or the data is inconsistent.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {visualizations.priceHistogram ? (
                        <div className="bg-gray-50 p-4 rounded-md">
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="text-lg font-semibold">
                              Price Distribution
                              <span className="ml-2 text-sm font-normal text-gray-500">
                                (Click to filter)
                              </span>
                            </h3>
                            {activeFilter && (
                              <button
                                onClick={clearFilters}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm transition duration-200"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          <div className="w-full" style={{ maxWidth: '100%', minHeight: '300px' }}>
                            <VegaChart 
                              spec={visualizations.priceHistogram} 
                              className="w-full h-auto"
                              onSignalClick={handleHistogramClick}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 p-4 rounded-md">
                          <h3 className="text-lg font-semibold mb-2">Price Distribution</h3>
                          <div className="w-full flex items-center justify-center" style={{ minHeight: '200px' }}>
                            <div className="text-center p-6">
                              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                              <h3 className="mt-2 text-sm font-medium text-gray-900">No price distribution data available</h3>
                              <p className="mt-1 text-sm text-gray-500">
                                We couldn't generate a price distribution chart for this search. This may be because there are too few results or the data is inconsistent.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {visualizations.priceMileageScatter ? (
                        <div className="bg-gray-50 p-4 rounded-md">
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="text-lg font-semibold">
                              Price vs Mileage
                              <span className="ml-2 text-sm font-normal text-gray-500">
                                (Click on a point to view listing)
                              </span>
                            </h3>
                          </div>
                          <div className="w-full" style={{ maxWidth: '100%', minHeight: '300px' }}>
                            <VegaChart 
                              spec={filteredVisualizations?.priceMileageScatter || visualizations.priceMileageScatter} 
                              className="w-full h-auto"
                              onSignalClick={handleTimeSeriesClick}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 p-4 rounded-md">
                          <h3 className="text-lg font-semibold mb-2">Price vs Mileage</h3>
                          <div className="w-full flex items-center justify-center" style={{ minHeight: '200px' }}>
                            <div className="text-center p-6">
                              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                              <h3 className="mt-2 text-sm font-medium text-gray-900">No mileage data available</h3>
                              <p className="mt-1 text-sm text-gray-500">
                                We couldn't generate a price vs mileage chart for this search. This may be because mileage data is missing or inconsistent.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-6 rounded-md">
                      <div className="text-center">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No visualizations available</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          We couldn't generate visualizations for this search. This may be because there are no results matching your criteria.
                        </p>
                        <p className="mt-2 text-sm text-gray-500">
                          Try adjusting your search parameters or selecting a different make/model.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Scrollable side panel for results */}
                <div className="lg:w-1/3 flex-shrink-0">
                  <div className="bg-white rounded-lg border border-gray-200 h-full">
                    <div className="p-4 border-b border-gray-200">
                      <h3 className="text-xl font-semibold">
                        Recent Results
                        {activeFilter && (
                          <span className="ml-2 text-sm font-normal text-gray-500">
                            ({filteredResults.length} of {results.length})
                          </span>
                        )}
                      </h3>
                    </div>
                    <div className="overflow-y-auto" style={{ maxHeight: "calc(115vh)" }}>
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
                                        <span className="text-xs px-2 py-0.5 rounded-full">
                                          {result.mileage ? `${result.mileage.toLocaleString()}mi` : ''}
                                        </span>
                    
                                        {result.bidders && (
                                          <span className="text-xs px-2 py-0.5 ml-1 bg-blue-100 text-blue-800 rounded-full">
                                            {result.bidders} {result.bidders === 1 ? 'bid' : 'bids'}
                                          </span>
                                        )}
                                      </div>
                                      {result.end_date && (
                                        <p className="text-xs text-gray-500 mt-1">
                                          {new Date(result.end_date).toLocaleDateString('en-US', {
                                            month: '2-digit',
                                            day: '2-digit',
                                            year: 'numeric'
                                          })}
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
        ) : !currentSearch ? (
          <div className="text-center py-12 bg-white shadow-md rounded-lg">
            <p className="text-gray-600 mb-4">Enter make and model above to analyze auction results</p>
          </div>
        ) : (
          <div className="bg-white shadow-md rounded-lg overflow-hidden p-8">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h3 className="mt-2 text-lg font-medium text-gray-900">No auction results found</h3>
              <p className="mt-1 text-md text-gray-500">
                We couldn't find any auction results matching your search criteria.
              </p>
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-900">Suggestions:</h4>
                <ul className="mt-2 list-disc list-inside text-sm text-gray-500">
                  <li>Check the spelling of the make and model</li>
                  <li>Try a more popular make or model</li>
                  <li>Expand your year range</li>
                  <li>Remove any filters that might be too restrictive</li>
                </ul>
              </div>
            </div>
          </div>
        )}
        
        {/* Display AI Results if they exist and showAiResults is true */}
        {showAiResults && aiResults.length > 0 && (
          <div className="mt-8 bg-white shadow-md rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold">AI Analysis Results</h2>
                <p className="text-sm text-gray-500">Results generated by the AI assistant</p>
              </div>
              <button 
                onClick={() => setShowAiResults(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            {isAggregateData(aiResults) ? (
              // Display for aggregate/summary data
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium mb-3">Data Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {aiResults.map((result, index) => {
                    // Find the first property that could be a category identifier 
                    // (excluding price, counts and metadata fields)
                    let categoryKey = '';
                    let categoryValue = '';
                    const keys = Object.keys(result);
                    const ignoredKeys = ['price', 'sold_price', 'bid_amount', 'url', 'images', 'bidders', 'watchers', 'comments', 'mileage', 'status', 'end_date'];
                    
                    // Try to find a good category key (like color, make, model, year, etc.)
                    for (const key of keys) {
                      if (!ignoredKeys.includes(key) && result[key] !== undefined && result[key] !== null) {
                        categoryKey = key;
                        categoryValue = String(result[key]);
                        break;
                      }
                    }
                    
                    // Use category value if available, otherwise fallback to title/make or generic category
                    const cardTitle = categoryValue || result.title || result.make || `Category ${index + 1}`;
                    const cardValue = result.sold_price || result.bid_amount || (result.price ? `$${result.price.toLocaleString()}` : '');
                    
                    return (
                      <div key={index} className="bg-white p-4 rounded-lg shadow-sm">
                        <h4 className="font-medium text-gray-800">{cardTitle}</h4>
                        {cardValue && <p className="text-xl font-bold mt-1">{cardValue}</p>}
                        
                        {/* Display any additional fields that might be present */}
                        <div className="mt-2 text-sm text-gray-600">
                          {Object.entries(result).map(([key, val]) => {
                            // Skip already displayed fields, the category key we used for the title, and empty values
                            if (['title', 'make', 'sold_price', 'bid_amount', 'price', 'url', 'images'].includes(key) || 
                                key === categoryKey || !val) return null;
                            
                            // Handle different value types
                            let displayValue: React.ReactNode;
                            if (typeof val === 'object') {
                              // For complex objects, display a simplified representation
                              displayValue = JSON.stringify(val).substring(0, 30) + '...';
                            } else if (typeof val === 'number') {
                              displayValue = val.toLocaleString();
                            } else {
                              displayValue = String(val);
                            }
                            
                            return (
                              <div key={key} className="flex justify-between items-center mt-1">
                                <span className="capitalize">{key.replace(/_/g, ' ')}:</span>
                                <span className="font-medium">{displayValue}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              // Standard table display for individual auction listings
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                    <th scope="col" className="px-4 py-3 w-24 sm:w-28 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                      <th scope="col" className="px-3 py-3 max-w-[120px] sm:max-w-xs text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mileage</th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {aiResults.map((result, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-2 py-4 w-24 sm:w-28 whitespace-nowrap text-sm font-medium text-gray-900">
                          {result.url ? (
                            <a href={result.url} target="_blank" rel="noopener noreferrer">
                              <img src={result.image_url} alt={result.title} className="w-20 h-20 rounded-md object-cover" />
                            </a>
                          ) : (
                            <img src={result.image_url} alt={result.title} className="w-20 h-20 rounded-md object-cover" />
                          )}
                        </td>
                        <td className="px-3 py-4 max-w-[120px] sm:max-w-xs whitespace-normal text-sm font-medium text-gray-900">
                          {result.url ? (
                            <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              {result.title}
                            </a>
                          ) : (
                            result.title
                          )}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{result.sold_price || result.bid_amount}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{result.end_date}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                          {result.mileage && <span className="mr-2">{result.mileage.toLocaleString()} mi</span>}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{isNumber(result.sold) ? 'Sold' : 'Unsold'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        
        {/* Add AI Agent for auction results */}
        {!loading && (
          <div className="mt-8">
            <AuctionAIAgent 
              auctionResults={results} 
              onAIResultsChange={handleAIResultsChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Main auctions component with Suspense boundary
export default function Auctions() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading auctions...</div>}>
      <AuctionsContent />
    </Suspense>
  );
} 