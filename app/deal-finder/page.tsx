'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { TopLevelSpec } from 'vega-lite';
import VegaChart from '@/components/shared/VegaChart';
import { formatPrice } from '@/lib/scrapers/utils/index';

// Define types for the Deal Finder page
type Deal = {
  activeListing: {
    id: number;
    url: string;
    title: string;
    year: string;
    make: string;
    model: string;
    current_bid: number;
    current_bid_formatted: string;
    endDate: number;
    image_url: string;
    image_url_thumb: string;
    location: string;
    seller_username?: string;
    seller_id?: string;
    reserve_met?: boolean;
    reserve_not_met?: boolean;
    no_reserve?: boolean;
    premium?: boolean;
    featured?: boolean;
    mileage: number;
  };
  historicalData: {
    averagePrice: number;
    medianPrice: number;
    minPrice: number;
    maxPrice: number;
    recentSales: Array<{
      title: string;
      sold_price?: string;
      sold_date: string;
      mileage: number;
      url: string;
      image_url?: string;
    }>;
  };
  priceDifference: number;
  percentageDifference: number;
  dealScore: number;
  endingSoon: boolean;
};

// Define types for car data from Supabase
type CarMake = {
  Make: string;
};

type CarModel = {
  Model: string;
};

export default function DealFinder() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'timeAsc' | 'timeDesc' | 'dealScore'>('timeAsc');
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  
  // Form state - only updated on form submission
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    yearMin: '',
    yearMax: '',
    maxDeals: '10'
  });

  // Form refs for uncontrolled inputs
  const makeInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const yearMinInputRef = useRef<HTMLInputElement>(null);
  const yearMaxInputRef = useRef<HTMLInputElement>(null);

  // State for suggestions - kept separate from form state
  const [makeSuggestions, setMakeSuggestions] = useState<string[]>([]);
  const [showMakeSuggestions, setShowMakeSuggestions] = useState(false);
  
  // Debounce timers
  const makeDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // State for database connection status
  const [dbConnectionError, setDbConnectionError] = useState(false);

  // Update current time every minute for countdown timers
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute
    
    return () => clearInterval(timer);
  }, []);

  // Fetch make suggestions from Supabase with debounce
  const fetchMakeSuggestions = async (query: string) => {
    if (!query || query.length < 2) {
      setMakeSuggestions([]);
      return;
    }
    
    try {
      console.log('Fetching make suggestions for query:', query);
      const response = await fetch(`/api/cars?type=makes&query=${encodeURIComponent(query)}`);
      
      if (response.status === 503) {
        // Database connection error
        setDbConnectionError(true);
        setMakeSuggestions([]);
        return;
      }
      
      if (!response.ok) {
        console.error('Make suggestions API error:', response.status, response.statusText);
        // Don't throw error, just log it and return empty array
        setMakeSuggestions([]);
        return;
      }
      
      // Reset connection error state if we got a successful response
      setDbConnectionError(false);
      
      const data = await response.json();
      console.log('Received make suggestions data:', data);
      
      if (!data || !Array.isArray(data)) {
        console.error('Invalid make suggestions data format:', data);
        setMakeSuggestions([]);
        return;
      }
      
      // Get unique makes using Set to remove duplicates
      const uniqueMakes = Array.from(new Set(data.map((item: CarMake) => item.Make)))
        .filter((make): make is string => !!make)
        .sort()
        .slice(0, 5); // Limit to 5 results
      
      console.log('Processed unique makes:', uniqueMakes);
      
      // Only update the suggestions, not the form state
      setMakeSuggestions(uniqueMakes);
      setShowMakeSuggestions(uniqueMakes.length > 0);
    } catch (error) {
      console.error('Error fetching make suggestions:', error);
      // Don't show error to user, just silently fail
      setMakeSuggestions([]);
      setShowMakeSuggestions(false);
    }
  };
  
  // Debounced version of fetchMakeSuggestions
  const debouncedFetchMakeSuggestions = (query: string) => {
    // Clear any existing timer
    if (makeDebounceTimerRef.current) {
      clearTimeout(makeDebounceTimerRef.current);
    }
    
    // Set a new timer
    makeDebounceTimerRef.current = setTimeout(() => {
      fetchMakeSuggestions(query);
    }, 300); // 300ms delay
  };

  // Handle suggestion selection
  const handleSuggestionClick = (name: string, value: string) => {
    if (name === 'make') {
      if (makeInputRef.current) {
        makeInputRef.current.value = value;
      }
      
      // Clear model when make changes
      if (modelInputRef.current) {
        modelInputRef.current.value = '';
      }
      
      setShowMakeSuggestions(false);
    } else if (name === 'model') {
      if (modelInputRef.current) {
        modelInputRef.current.value = value;
      }
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowMakeSuggestions(false);
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (makeDebounceTimerRef.current) {
        clearTimeout(makeDebounceTimerRef.current);
      }
    };
  }, []);

  // Handle sort change
  const handleSortChange = (newSortOrder: 'timeAsc' | 'timeDesc' | 'dealScore') => {
    setSortOrder(newSortOrder);
  };

  // Sort deals based on current sort order
  const sortedDeals = [...deals].sort((a, b) => {
    if (sortOrder === 'timeAsc') {
      // Sort by time remaining (ascending - ending soonest first)
      return a.activeListing.endDate - b.activeListing.endDate;
    } else if (sortOrder === 'timeDesc') {
      // Sort by time remaining (descending - ending latest first)
      return b.activeListing.endDate - a.activeListing.endDate;
    } else {
      // Sort by deal score (descending - best deals first)
      return b.dealScore - a.dealScore;
    }
  });

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Get values from refs
    const make = makeInputRef.current?.value || '';
    const model = modelInputRef.current?.value || '';
    const yearMin = yearMinInputRef.current?.value || '';
    const yearMax = yearMaxInputRef.current?.value || '';
    const maxDeals = formData.maxDeals; // Use the default value from formData
    
    // Validate required fields
    if (!make) {
      setError('Make is a required field');
      return;
    }
    
    // Create submission data
    const submissionData = {
      make,
      model,
      yearMin,
      yearMax,
      maxDeals
    };
    
    // Update form data state
    setFormData(submissionData);
    
    setLoading(true);
    setError(null);
    setDeals([]);

    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (make) params.append('make', make);
      if (model) params.append('model', model);
      if (yearMin) params.append('yearMin', yearMin);
      if (yearMax) params.append('yearMax', yearMax);
      if (maxDeals) params.append('maxDeals', maxDeals);

      // Fetch deals from the API
      const response = await fetch(`/api/deal-finder?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();

      // Handle error message from API
      if (data.message) {
        setError(data.message);
        return;
      }
      
      if (data.deals && data.deals.length > 0) {
        setDeals(data.deals);
      } else {
        setError('No deals found matching your criteria. Try different search parameters.');
      }
    } catch (error) {
      console.error('Error fetching deals:', error);
      setError('Failed to fetch deals. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Format time remaining
  const formatTimeRemaining = (endDate: number) => {
    const now = new Date(currentTime); // Use the current time from state
    const end = new Date(endDate);
    const diffMs = end.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Ended';
    
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffDays > 0) {
      return `${diffDays}d ${diffHrs}h`;
    }
    
    return `${diffHrs}h ${diffMins}m`;
  };

  // Get time urgency class based on time remaining
  const getTimeUrgencyClass = (endDate: number) => {
    const now = new Date(currentTime); // Use the current time from state
    const end = new Date(endDate);
    const diffHours = (end.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (diffHours <= 6) {
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'; // Very urgent - ending within 6 hours
    } else if (diffHours <= 24) {
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300'; // Urgent - ending within 24 hours
    } else if (diffHours <= 48) {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'; // Soon - ending within 48 hours
    } else {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'; // Not urgent - ending in more than 48 hours
    }
  };

  // Check if auction is ending soon (within 24 hours)
  const isEndingSoon = (endDate: number) => {
    const now = Date.now();
    const hoursRemaining = (endDate - now) / (1000 * 60 * 60);
    return hoursRemaining <= 24;
  };

  // Handle historical price chart point click
  const handleHistoricalPriceClick = (name: string, value: any) => {
    if (name === 'pointClick' && value) {
      console.log('Historical price point clicked with data:', value);
      
      // Check if the point has a URL
      if (value.url && value.url !== '#') {
        console.log('Opening URL:', value.url);
        // Open the URL in a new tab
        window.open(value.url, '_blank');
      } else {
        console.log('No URL found for this point or URL is a placeholder');
      }
    }
  };

  // Parse price string to number
  const parsePriceString = (priceString: string | number): number | null => {
    if (typeof priceString === 'number') {
      return priceString;
    }
    
    if (typeof priceString === 'string') {
      // Remove currency symbols, commas, and other non-numeric characters except decimal point
      const cleanedPrice = priceString.replace(/[$,\s]/g, '');
      const price = parseFloat(cleanedPrice);
      
      if (!isNaN(price) && price > 0) {
        return price;
      }
    }
    
    return null;
  };

  // Generate price comparison chart
  const generatePriceComparisonChart = (deal: Deal): TopLevelSpec => {
    const data = [
      { 
        category: 'Current Bid', 
        price: deal.activeListing.current_bid,
        color: deal.dealScore >= 7 ? '#10b981' : deal.dealScore <= 3 ? '#ef4444' : '#3b82f6'
      },
      { 
        category: 'Average Price', 
        price: deal.historicalData.averagePrice,
        color: '#6b7280'
      },
      { 
        category: 'Median Price', 
        price: deal.historicalData.medianPrice,
        color: '#9ca3af'
      }
    ];

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Price Comparison',
      width: "container",
      height: 300,
      autosize: {
        type: "fit",
        contains: "padding",
        resize: true
      },
      data: { values: data },
      mark: {
        type: 'bar',
        tooltip: true
      },
      encoding: {
        x: { field: 'category', type: 'nominal', axis: { labelAngle: 0, title: null } },
        y: { 
          field: 'price', 
          type: 'quantitative',
          axis: { title: 'Price ($)', format: '~s' }
        },
        color: {
          field: 'color',
          type: 'nominal',
          scale: null
        },
        tooltip: [
          { field: 'category', type: 'nominal', title: 'Category' },
          { field: 'price', type: 'quantitative', title: 'Price', format: '$,.0f' },
        ]
      }
    };
  };

  // Generate historical price time series chart
  const generateHistoricalPriceChart = (deal: Deal): TopLevelSpec => {
    // Define type for chart data points
    type ChartDataPoint = {
      date: string;
      price: number;
      title: string;
      mileage: number;
      url: string;
      isCurrent?: boolean;
    };

    // Transform recent sales data for the chart
    const data: ChartDataPoint[] = deal.historicalData.recentSales.map(sale => {
      // Parse the price string to a number
      const price = parsePriceString(sale.sold_price || 0);
      // Skip entries with invalid prices
      if (price === null) {
        return null;
      }
      
      // Ensure date is in a format Vega-Lite can understand
      let formattedDate: string;
      try {
        // Try to parse and format the date consistently
        const dateObj = new Date(sale.sold_date);
        if (isNaN(dateObj.getTime())) {
          throw new Error('Invalid date');
        }
        formattedDate = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD format
      } catch (error) {
        console.error(`Invalid date format for ${sale.title}: ${sale.sold_date}`);
        return null;
      }
  
      return {
        date: formattedDate,
        price: price,
        title: sale.title,
        mileage: sale.mileage,
        url: sale.url
      };
    }).filter(item => item !== null) as ChartDataPoint[];

    // Sort by date
    data.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });

    // Add current listing as a highlighted point
    data.push({
      date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
      price: deal.activeListing.current_bid,
      title: deal.activeListing.title,
      mileage: deal.activeListing.mileage || 0,
      isCurrent: true,
      url: deal.activeListing.url
    });
    
    // Ensure we have enough data points for a meaningful chart
    if (data.length < 2) {
      // Add a dummy point in the past to ensure the chart renders
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      data.push({
        date: sixMonthsAgo.toISOString().split('T')[0],
        price: deal.activeListing.current_bid * 0.9, // 90% of current price
        title: "Historical Average",
        mileage: deal.activeListing.mileage || 0,
        isCurrent: false,
        url: deal.activeListing.url
      });
    }

    // Determine if we should show the trend line
    const showTrendLine = data.length >= 3;
    
    // Create the chart specification
    let chartSpec: TopLevelSpec;
    
    // Base chart configuration
    const baseSpec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Price Trends',
      width: "container",
      height: 300,
      autosize: {
        type: "fit",
        contains: "padding",
        resize: true
      },
      data: { values: data },
      mark: {
        type: 'circle',
        filled: true,
        tooltip: true,
        opacity: 0.8,
        cursor: 'pointer'  // Add cursor pointer to indicate clickability
      },
      encoding: {
        x: {
          field: 'date',
          type: 'temporal',
          title: null,
          axis: {
            format: '%b %d',
            labelAngle: -45,
            grid: true,
            labelLimit: 100,
            title: null
          },
          scale: {
            padding: 10
          }
        },
        y: {
          field: 'price',
          type: 'quantitative',
          title: 'Sale Price ($)',
          scale: { 
            zero: false,
            padding: 20
          },
          axis: {
            format: '$~s'
          }
        },
        // Use size as a value instead of a field to avoid the warning
        size: {
          condition: { test: "datum.isCurrent", value: 120 },
          value: 80
        },
        color: {
          condition: { test: "datum.isCurrent", value: "#ef4444" },
          value: "#3b82f6",
          legend: null // Disable the legend
        },
        tooltip: [
          { field: 'date', type: 'temporal', title: 'Date', format: '%b %d, %Y' },
          { field: 'price', type: 'quantitative', title: 'Price', format: '$,.0f' },
          { field: 'title', type: 'nominal', title: 'Vehicle' },
          { field: 'mileage', type: 'quantitative', title: 'Mileage', format: '~s' }
        ]
      }
    };
    
    // If we have enough data points, create a layered chart with trend line
    if (showTrendLine) {
      chartSpec = {
        $schema: baseSpec.$schema,
        description: baseSpec.description,
        width: baseSpec.width,
        height: baseSpec.height,
        autosize: baseSpec.autosize,
        layer: [
          // Main data points
          {
            data: baseSpec.data,
            mark: {
              ...baseSpec.mark,
              cursor: 'pointer'  // Ensure cursor pointer is applied in layered chart
            },
            encoding: baseSpec.encoding
          },
          // Trend line
          {
            data: baseSpec.data,
            mark: {
              type: 'line',
              color: "#9ca3af",
              strokeWidth: 2,
              strokeDash: [4, 2]
            },
            transform: [
              {
                regression: "price",
                on: "date",
                method: "linear" as const
              }
            ],
            encoding: {
              x: { field: "date", type: "temporal" },
              y: { field: "price", type: "quantitative" }
            }
          }
          // Legend layer removed
        ]
      } as TopLevelSpec;
    } else {
      // Otherwise, just use the base spec without legend
      chartSpec = {
        $schema: baseSpec.$schema,
        description: baseSpec.description,
        width: baseSpec.width,
        height: baseSpec.height,
        autosize: baseSpec.autosize,
        layer: [
          {
            data: baseSpec.data,
            mark: {
              ...baseSpec.mark,
              cursor: 'pointer'  // Ensure cursor pointer is applied in layered chart
            },
            encoding: baseSpec.encoding
          }
          // Legend layer removed
        ]
      } as TopLevelSpec;
    }
    
    return chartSpec;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
              Deal Finder
            </h1>
            <p className="mt-2 text-lg text-gray-500 dark:text-gray-300">
              Find the best deals on current auctions
            </p>
          </div>
        </div>

        {dbConnectionError && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6">
            <p className="font-medium">Database connection unavailable</p>
            <p className="text-sm">Autocomplete suggestions are not available. You can still enter make and model manually.</p>
          </div>
        )}

        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Find Deals</h2>
          <form onSubmit={handleSubmit}>
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
                  defaultValue={formData.make}
                  onChange={(e) => {
                    // Only fetch suggestions, don't update form state
                    if (e.target.value.length >= 2) {
                      debouncedFetchMakeSuggestions(e.target.value);
                    } else {
                      // Clear suggestions if input is too short
                      setMakeSuggestions([]);
                      setShowMakeSuggestions(false);
                    }
                  }}
                  onFocus={(e) => {
                    // Only fetch suggestions on focus if input has enough characters
                    if (e.target.value.length >= 2) {
                      debouncedFetchMakeSuggestions(e.target.value);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
                  placeholder={dbConnectionError ? "Enter car make manually..." : "Start typing to see suggestions..."}
                  autoComplete="off"
                  required
                />
                {showMakeSuggestions && makeSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 top-full bg-white dark:bg-gray-700 shadow-lg rounded-md border border-gray-200 dark:border-gray-600 max-h-60 overflow-y-auto">
                    <div className="py-1">
                      {makeSuggestions.map((make, index) => (
                        <div
                          key={index}
                          className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors duration-150"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSuggestionClick('make', make);
                          }}
                        >
                          {make}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col">
                <label htmlFor="model" className="mb-1 font-medium">
                  Model
                </label>
                <input
                  type="text"
                  id="model"
                  name="model"
                  ref={modelInputRef}
                  defaultValue={formData.model}
                  className="border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
                  placeholder={makeInputRef.current?.value ? `Enter ${makeInputRef.current.value} model...` : "First select a make..."}
                  autoComplete="off"
                />
              </div>
              
              <div className="flex flex-col">
                <label htmlFor="yearMin" className="mb-1 font-medium">
                  Year (Min)
                </label>
                <input
                  type="text"
                  id="yearMin"
                  name="yearMin"
                  ref={yearMinInputRef}
                  defaultValue={formData.yearMin}
                  className="border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
                  placeholder="e.g. 1950"
                />
              </div>
              
              <div className="flex flex-col">
                <label htmlFor="yearMax" className="mb-1 font-medium">
                  Year (Max)
                </label>
                <input
                  type="text"
                  id="yearMax"
                  name="yearMax"
                  ref={yearMaxInputRef}
                  defaultValue={formData.yearMax}
                  className="border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
                  placeholder="e.g. 2025"
                />
              </div>
              <div className="md:col-span-2 lg:col-span-5 flex justify-end">
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition-colors"
                  disabled={loading}
                >
                  {loading ? 'Searching...' : 'Find Deals'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 mb-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}

        {/* Results */}
        {!loading && deals.length > 0 && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {deals.length} Deal{deals.length !== 1 ? 's' : ''} Found
              </h2>
              
              <div className="mt-3 sm:mt-0">
                <label htmlFor="sort-order" className="mr-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Sort by:
                </label>
                <select
                  id="sort-order"
                  value={sortOrder}
                  onChange={(e) => handleSortChange(e.target.value as 'timeAsc' | 'timeDesc' | 'dealScore')}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                >
                  <option value="timeAsc">Ending Soon</option>
                  <option value="timeDesc">Ending Later</option>
                  <option value="dealScore">Best Deal</option>
                </select>
              </div>
            </div>
            
            <div className="space-y-8">
              {sortedDeals.map((deal, index) => (
                <div key={index} className="bg-gray-50 dark:bg-gray-700 shadow rounded-lg overflow-hidden">
                  <div className="p-6">
                    <div className="flex flex-col md:flex-row">
                      {/* Image */}
                      <div className="md:w-1/3 mb-4 md:mb-0 md:pr-6">
                        <div className="relative h-64 w-full rounded-lg overflow-hidden">
                          <Image
                            src={deal.activeListing.image_url || '/placeholder-car.jpg'}
                            alt={deal.activeListing.title}
                            fill
                            className="object-cover"
                          />
                        </div>
                      </div>
                      
                      {/* Details */}
                      <div className="md:w-2/3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                            <a href={deal.activeListing.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              {deal.activeListing.title}
                            </a>
                            {deal.activeListing.mileage && (
                                <span className="ml-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                                  {deal.activeListing.mileage.toLocaleString()} mi
                                </span>
                              )}
                          </h3>
                          
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mt-2 sm:mt-0 sm:ml-3 ${
                            deal.dealScore >= 8 ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                            deal.dealScore >= 6 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' :
                            deal.dealScore >= 4 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' :
                            'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                          }`}>
                            {/* Add icon based on deal score */}
                            {deal.dealScore >= 8 && (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            )}
                            {deal.dealScore >= 6 && deal.dealScore < 8 && (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            )}
                            {deal.dealScore >= 4 && deal.dealScore < 6 && (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            )}
                            {deal.dealScore < 4 && (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                            )}
                            Deal Score: {deal.dealScore}/10
                          </span>
                        </div>
                        
                        <div className="mt-2 grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Current Bid</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              {deal.activeListing.current_bid_formatted}
   
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Time Remaining</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mr-2 ${getTimeUrgencyClass(deal.activeListing.endDate)}`}>
                                {formatTimeRemaining(deal.activeListing.endDate)}
                              </span>
                              {isEndingSoon(deal.activeListing.endDate) && (
                                <>
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300 mr-2">
                                    Ending Soon!
                                  </span>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 animate-pulse" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                  </svg>
                                </>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Average Historical Price</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              {formatPrice(deal.historicalData.averagePrice)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Price Difference</p>
                            <p className={`text-lg font-semibold ${
                              deal.priceDifference > 0 
                                ? 'text-green-600 dark:text-green-400' 
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {deal.priceDifference > 0 ? '+' : ''}{formatPrice(deal.priceDifference)} 
                              ({deal.percentageDifference > 0 ? '+' : ''}{deal.percentageDifference.toFixed(1)}%)
                            </p>
                          </div>
                        </div>
                        
                        {/* Price Comparison Chart */}
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                              Price Comparison
                            </h4>
                            <div className="w-full" style={{ minHeight: '300px' }}>
                              <VegaChart 
                                spec={generatePriceComparisonChart(deal)} 
                                className="w-full h-auto"
                              />
                            </div>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                               Price Trends
                              <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                                (Click on a point to view listing)
                              </span>
                            </h4>
                            <div className="w-full" style={{ minHeight: '300px' }}>
                              <VegaChart 
                                spec={generateHistoricalPriceChart(deal)} 
                                className="w-full h-auto"
                                onSignalClick={handleHistoricalPriceClick}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Recent Sales */}
                    <div className="mt-6">
                      <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                        Recent Similar Sales
                      </h4>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
                        <div className="overflow-y-auto overflow-x-auto" style={{ maxHeight: "300px" }}>
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-100 dark:bg-gray-600">
                              <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                  Vehicle
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                  Mileage
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                  Sold Price
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                  Date
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                              {deal.historicalData.recentSales.map((sale, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                    <a href={sale.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 hover:underline">
                                      {sale.title}
                                    </a>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                    {sale.mileage ? `${sale.mileage.toLocaleString()}mi` : ''}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                    {formatPrice(sale.sold_price)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                    {sale.sold_date}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 