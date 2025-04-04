'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { TopLevelSpec } from 'vega-lite';
import VegaChart from '@/components/shared/VegaChart';
import { formatPrice } from '@/lib/utils/index';
import { decodeHtmlEntities } from '@/components/shared/utils';
// Import Shadcn UI components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Form, FormSection, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Select, SelectValue, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

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
    predicted_price: number | null;
  };
  historicalData: {
    averagePrice: number;
    medianPrice: number;
    minPrice: number;
    maxPrice: number;
    recentSales: Array<{
      title: string;
      sold_price?: string;
      end_date: string;
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
  make: string;
};

type CarModel = {
  model: string;
};

export default function DealFinder() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'timeAsc' | 'timeDesc' | 'dealScore'>('timeAsc');
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [availableMakes, setAvailableMakes] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [activeListings, setActiveListings] = useState<any[]>([]);
  
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
  const modelInputRef = useRef<HTMLSelectElement>(null);
  const yearMinInputRef = useRef<HTMLInputElement>(null);
  const yearMaxInputRef = useRef<HTMLInputElement>(null);
  
  // State for database connection status
  const [dbConnectionError, setDbConnectionError] = useState(false);

  // Update current time every minute for countdown timers
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute
    
    return () => clearInterval(timer);
  }, []);

  // Fetch deals ending soonest when the page loads
  useEffect(() => {
    fetchEndingSoonDeals();
  }, []);

  // Update models when make changes
  const handleMakeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Don't update models on every change, only clear them if make is cleared
    if (!e.target.value) {
      if (modelInputRef.current) {
        modelInputRef.current.value = '';
      }
      setAvailableModels([]);
    }
  };

  // Handle make selection from datalist
  const handleMakeSelect = (e: React.FocusEvent<HTMLInputElement>) => {
    const selectedMake = e.target.value;
    
    // Clear model when make changes
    if (modelInputRef.current) {
      modelInputRef.current.value = '';
    }

    // If no make is selected, clear models
    if (!selectedMake) {
      setAvailableModels([]);
      return;
    }

    // Only update models if the make exists in availableMakes
    if (availableMakes.includes(selectedMake)) {
      // Extract unique models for the selected make from activeListings
      const models = Array.from(new Set(
        activeListings
          .filter(listing => listing.make === selectedMake)
          .map(listing => listing.model as string)
          .filter((model): model is string => Boolean(model))
      )).sort();

      setAvailableModels(models);
    }
  };

  // Update fetchEndingSoonDeals to store activeListings
  const fetchEndingSoonDeals = async () => {
    setLoading(true);
    setError(null);
    setDeals([]);
    // Set sort order to time ascending by default
    setSortOrder('timeAsc');

    try {
      // Build query parameters - only include maxDeals
      const params = new URLSearchParams();
      params.append('maxDeals', formData.maxDeals);

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
        // Store activeListings
        setActiveListings(data.activeListings);
        
        // Extract unique makes from activeListings
        const uniqueMakes = Array.from(new Set(data.activeListings
          .map((listing: any) => listing.make as string)
          .filter((make: string | undefined): make is string => Boolean(make)) // Type guard to ensure non-null strings
          .sort()
        )) as string[];
        setAvailableMakes(uniqueMakes);
        setDeals(data.deals);
      } else {
        setError('No deals found. Try different search parameters.');
      }
    } catch (error) {
      console.error('Error fetching deals:', error);
      setError('Failed to fetch deals. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

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
    
    // If all fields are empty, fetch ending soon deals
    if (!make && !model && !yearMin && !yearMax) {
      fetchEndingSoonDeals();
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
        const dateObj = new Date(sale.end_date);
        if (isNaN(dateObj.getTime())) {
          throw new Error('Invalid date');
        }
        formattedDate = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD format
      } catch (error) {
        console.error(`Invalid date format for ${sale.title}: ${sale.end_date}`);
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
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Deal Finder
            </h1>
          <p className="mt-2 text-lg text-gray-500">
              Find current auctions likely to end below market value
            </p>
          </div>
        </div>
        
        {/* Search Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Search Criteria</CardTitle>
            <CardDescription>Enter vehicle details to find matching deals</CardDescription>
          </CardHeader>
          <CardContent>
            <Form onSubmit={handleSubmit}>
              <FormSection className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <FormItem>
                  <FormLabel htmlFor="make">Make</FormLabel>
                  <FormControl>
                    <Input
                      id="make"
                      name="make"
                      ref={makeInputRef}
                      type="text"
                      list="makes-list"
                      placeholder="Enter make..."
                      onChange={handleMakeChange}
                      onBlur={handleMakeSelect}
                    />
                  </FormControl>
                  <datalist id="makes-list">
                    {availableMakes.map((make) => (
                      <option key={make} value={make} />
                    ))}
                  </datalist>
                </FormItem>
                
                <FormItem>
                  <FormLabel htmlFor="model">Model</FormLabel>
                  <FormControl>
                    <select
                      id="model"
                      name="model"
                      ref={modelInputRef}
                      className="w-full border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
                      disabled={availableModels.length === 0}
                    >
                      <option value="">Any model</option>
                      {availableModels.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  </FormControl>
                </FormItem>
                
                <FormItem>
                  <FormLabel htmlFor="yearMin">Year (Min)</FormLabel>
                  <FormControl>
                    <Input
                      id="yearMin"
                      name="yearMin"
                      ref={yearMinInputRef}
                      type="number"
                      placeholder="1950"
                      min="1900"
                      max="2025"
                    />
                  </FormControl>
                </FormItem>
                
                <FormItem>
                  <FormLabel htmlFor="yearMax">Year (Max)</FormLabel>
                  <FormControl>
                    <Input
                      id="yearMax"
                      name="yearMax"
                      ref={yearMaxInputRef}
                      type="number"
                      placeholder="2025"
                      min="1900"
                      max="2025"
                    />
                  </FormControl>
                </FormItem>
                
                <FormItem>
                  <FormLabel htmlFor="maxDeals">Max Deals</FormLabel>
                  <FormControl>
                    <select
                      id="maxDeals"
                      name="maxDeals"
                      value={formData.maxDeals}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxDeals: e.target.value }))}
                      className="w-full border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
                    >
                      <option value="5">5</option>
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="50">50</option>
                    </select>
                  </FormControl>
                </FormItem>
                
                <div className="md:col-span-2 lg:col-span-5 flex justify-end gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={fetchEndingSoonDeals}
                    disabled={loading}
                  >
                    Show Ending Soon
                  </Button>
                  
                  <Button
                    type="submit"
                    disabled={loading}
                  >
                    Find Deals
                  </Button>
                </div>
              </FormSection>
            </Form>
          </CardContent>
        </Card>
        
        {/* Sort Options */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">
            {deals.length > 0 ? 'Deals Found' : 'No deals found'} 
            {loading && <span className="ml-2 text-sm font-normal text-gray-500">Loading...</span>}
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
                              {decodeHtmlEntities(deal.activeListing.title)}
                            </a>
                            {deal.activeListing.mileage && (
                                <span className="ml-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                                  {deal.activeListing.mileage.toLocaleString()} mi
                                </span>
                              )}
                          </h3>
                          
                          <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium mt-2 sm:mt-0 sm:ml-3 min-w-[120px] justify-center whitespace-nowrap ${
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
                              {formatPrice(deal.activeListing.current_bid)}
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
                          {deal.activeListing.predicted_price && (
                            <div>
                              <p className="text-sm text-gray-500 dark:text-gray-400">Predicted Price</p>
                              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                {formatPrice(deal.activeListing.predicted_price)}
                                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                                  (AI Prediction)
                                </span>
                              </p>
                            </div>
                          )}
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
                                (Click to view listing)
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
                                    {new Date(sale.end_date).toLocaleDateString()}
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