'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import ListingCard, { Listing } from '@/components/listings/ListingCard';
import ListingsAIAgent from '@/components/agent/ListingsAIAgent';
import { generateHistogram } from '@/lib/utils/visualization';
import type { TopLevelSpec } from 'vega-lite';
import VegaChart from '@/components/shared/VegaChart';
// Import Shadcn UI components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Form, FormSection, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// CSS for animations
const fadeInAnimation = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fadeIn 0.3s ease-out forwards;
  }
`;

type SearchResponse = {
  results: Listing[];
  pagination: {
    totalResults: number;
    totalPages: number;
    currentPage: number;
  };
  summary: {
    totalResults: number;
    averagePrice: number;
    highestPrice: number;
    lowestPrice: number;
  };
  visualizations: any;
  error?: string;
};

// Define types for car data from Supabase
type CarMake = {
  make: string;
};

type CarModel = {
  model: string;
};

// Debounce function to delay search execution
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    // Set a timeout to update the debounced value after the specified delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    // Clear the timeout if the value changes before the delay expires
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);
  
  return debouncedValue;
}

// Create a separate component that uses useSearchParams
function ListingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Form state
  const [make, setMake] = useState(searchParams.get('make') || '');
  const [model, setModel] = useState(searchParams.get('model') || '');
  const [trim, setTrim] = useState(searchParams.get('trim') || '');
  const [yearMin, setYearMin] = useState(searchParams.get('yearMin') || '');
  const [yearMax, setYearMax] = useState(searchParams.get('yearMax') || '');
  const [transmission, setTransmission] = useState(searchParams.get('transmission') || 'Any');
  const [makeOptions, setMakeOptions] = useState<string[]>([]);
  
  // Notification state
  const [notification, setNotification] = useState<string | null>(null);
  
  // Debounce timers
  const notificationTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // State for database connection status
  const [dbConnectionError, setDbConnectionError] = useState(false);
  
  // Debounced form values
  const debouncedMake = useDebounce(make, 500);
  
  // Results state
  const [results, setResults] = useState<Listing[]>([]);
  const [summary, setSummary] = useState<SearchResponse['summary'] | null>(null);
  const [pagination, setPagination] = useState<SearchResponse['pagination'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter state
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [mileageMin, setMileageMin] = useState('');
  const [mileageMax, setMileageMax] = useState('');
  const [filteredResults, setFilteredResults] = useState<Listing[]>([]);
  
  // Sort state
  const [sortBy, setSortBy] = useState('price');
  const [sortOrder, setSortOrder] = useState('asc');
  
  // Track if this is an initial load or a user-initiated search
  const isInitialLoad = useRef(true);

  // Add state for visualizations
  const [priceHistogram, setPriceHistogram] = useState<TopLevelSpec | null>(null);
  const [mileageHistogram, setMileageHistogram] = useState<TopLevelSpec | null>(null);
  
  // State for suggestions
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [trimOptions, setTrimOptions] = useState<string[]>([]);

  // Show notification for a short time
  const showNotification = (message: string) => {
    // Clear any existing notification timer
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
    }
    
    // Set the notification message
    setNotification(message);
    
    // Clear the notification after 3 seconds
    notificationTimerRef.current = setTimeout(() => {
      setNotification(null);
    }, 3000);
  };
  
  // Clean up notification timer on unmount
  useEffect(() => {
    return () => {
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }
    };
  }, []);

  // Fetch model options from MarketCheck API
  const fetchModelOptions = async () => {
    if (!make) {
      setModelOptions([]);
      return;
    }
    
    try {
      console.log('Fetching model options for make:', make);
      const response = await fetch(`/api/marketcheck?field=model&input=&make=${encodeURIComponent(make)}`);
      
      if (response.status === 503) {
        setDbConnectionError(true);
        setModelOptions([]);
        return;
      }
      
      if (!response.ok) {
        console.error('Model options API error:', response.status, response.statusText);
        setModelOptions([]);
        return;
      }
      
      setDbConnectionError(false);
      
      const data = await response.json();
      console.log('Received model options data:', data);
      
      if (!data || !data.suggestions || !Array.isArray(data.suggestions)) {
        console.error('Invalid model options data format:', data);
        setModelOptions([]);
        return;
      }
      
      const uniqueModels = Array.from(new Set(data.suggestions))
        .filter((model): model is string => !!model)
        .sort();
      
      setModelOptions(uniqueModels);
    } catch (error) {
      console.error('Error fetching model options:', error);
      setModelOptions([]);
    }
  };

  // Fetch trim options from MarketCheck API
  const fetchTrimOptions = async () => {
    if (!make || !model) {
      setTrimOptions([]);
      return;
    }
    
    try {
      console.log('Fetching trim options for', make, model);
      const response = await fetch(
        `/api/marketcheck?field=trim&input=&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`
      );
      
      if (response.status === 503) {
        setDbConnectionError(true);
        setTrimOptions([]);
        return;
      }
      
      if (!response.ok) {
        console.error('Trim options API error:', response.status, response.statusText);
        setTrimOptions([]);
        return;
      }
      
      setDbConnectionError(false);
      
      const data = await response.json();
      console.log('Received trim options data:', data);
      
      if (!data || !data.suggestions || !Array.isArray(data.suggestions)) {
        console.error('Invalid trim options data format:', data);
        setTrimOptions([]);
        return;
      }
      
      const uniqueTrims = Array.from(new Set(data.suggestions))
        .filter((trim): trim is string => !!trim)
        .sort();
      
      setTrimOptions(uniqueTrims);
    } catch (error) {
      console.error('Error fetching trim options:', error);
      setTrimOptions([]);
    }
  };

  // Load model options when make is set - with debounce
  useEffect(() => {
    if (debouncedMake) {
      fetchModelOptions();
    } else {
      setModelOptions([]);
    }
  }, [debouncedMake]);

  // Load trim options when make and model are set
  useEffect(() => {
    if (make && model) {
      fetchTrimOptions();
    } else {
      setTrimOptions([]);
    }
  }, [make, model]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'make') {
      setMake(value);
      // Clear model and trim when make changes
      if (model) {
        setModel('');
        setModelOptions([]);
      }
      if (trim) {
        setTrim('');
        setTrimOptions([]);
      }
    } else if (name === 'model') {
      setModel(value);
      // Clear trim when model changes
      if (trim) {
        setTrim('');
        setTrimOptions([]);
      }
    } else if (name === 'trim') {
      setTrim(value);
    } else if (name === 'yearMin') {
      setYearMin(value);
    } else if (name === 'yearMax') {
      setYearMax(value);
    } else if (name === 'transmission') {
      setTransmission(value);
    }
  };
  
  // Define handleSearch as a useCallback to prevent unnecessary re-creation
  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!make) {
      setError('Make is required');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          make,
          model: model || undefined,
          trim: trim || undefined,
          yearMin: yearMin ? parseInt(yearMin) : undefined,
          yearMax: yearMax ? parseInt(yearMax) : undefined,
          transmission: transmission !== 'Any' ? transmission : undefined,
          maxResults: 100,
        }),
      });
      
      const data: SearchResponse = await response.json();

      // Check if the API returned an error
      if (!response.ok || data.error) {
        throw new Error(data.error || `API error: ${response.status}`);
      }
      
      // Check if we have results
      if (!data.results || !Array.isArray(data.results)) {
        throw new Error('No results returned from API');
      }
      setResults(data.results);
      setSummary(data.summary);
      setPagination(data.pagination);
    } catch (err) {
      setResults([]);
      setSummary(null);
      setPagination(null);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [make, model, trim, yearMin, yearMax, transmission, router]);

  // Load results if URL has search params on initial load
  useEffect(() => {
    if (isInitialLoad.current && (searchParams.has('make') || searchParams.has('transmission'))) {
      handleSearch();
      isInitialLoad.current = false;
    }
  }, [searchParams, handleSearch]);

  // Apply filters and sorting to results
  useEffect(() => {
    console.log('Filtering effect triggered with:', { 
      resultsLength: results.length, 
      priceMin, 
      priceMax, 
      mileageMin, 
      mileageMax, 
      sortBy, 
      sortOrder 
    });
    
    if (results.length === 0) {
      setFilteredResults([]);
      return;
    }

    let filtered = [...results];

    // Apply price filter
    if (priceMin) {
      filtered = filtered.filter(item => item.price >= parseInt(priceMin));
    }
    if (priceMax) {
      filtered = filtered.filter(item => item.price <= parseInt(priceMax));
    }

    // Apply mileage filter
    if (mileageMin) {
      filtered = filtered.filter(item => item.mileage >= parseInt(mileageMin));
    }
    if (mileageMax) {
      filtered = filtered.filter(item => item.mileage <= parseInt(mileageMax));
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'price':
          comparison = a.price - b.price;
          break;
        case 'year':
          comparison = a.year - b.year;
          break;
        case 'mileage':
          comparison = a.mileage - b.mileage;
          break;
        default:
          comparison = a.price - b.price;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    console.log(`Filtered results: ${filtered.length} of ${results.length}`);
    setFilteredResults(filtered);
  }, [results, priceMin, priceMax, mileageMin, mileageMax, sortBy, sortOrder]);

  // Generate histograms when filtered results change
  useEffect(() => {
    console.log('Filtered results length:', filteredResults.length);
    if (filteredResults.length > 0) {
      try {
        console.log('Generating histograms for', filteredResults.length, 'listings');
        
        // Make sure we're working with valid data
        const validPriceListings = filteredResults.filter(listing => 
          listing && typeof listing.price === 'number' && listing.price > 0
        );
        
        const validMileageListings = filteredResults.filter(listing => 
          listing && typeof listing.mileage === 'number' && listing.mileage > 0
        );
        
        console.log('Valid price listings:', validPriceListings.length);
        console.log('Valid mileage listings:', validMileageListings.length);
        
        if (validPriceListings.length > 0) {
          const priceHistogramSpec = generateHistogram(validPriceListings, {
            field: 'price',
            description: 'Listing Price Distribution',
            xAxisTitle: 'Price Range ($)',
            yAxisTitle: 'Number of Vehicles',
            filter: (listing) => listing.price > 0,
            additionalFields: ['title', 'url', 'year', 'make', 'model'],
            interactive: true
          });
          console.log('Price histogram spec generated:', priceHistogramSpec);
          setPriceHistogram(priceHistogramSpec);
        } else {
          console.log('No valid price data for histogram');
          setPriceHistogram(null);
        }
        
        if (validMileageListings.length > 0) {
          const mileageHistogramSpec = generateHistogram(validMileageListings, {
            field: 'mileage',
            description: 'Listing Mileage Distribution',
            xAxisTitle: 'Mileage Range',
            yAxisTitle: 'Number of Vehicles',
            filter: (listing) => listing.mileage > 0,
            additionalFields: ['title', 'url', 'year', 'make', 'model'],
            interactive: true
          });
          console.log('Mileage histogram spec generated:', mileageHistogramSpec);
          setMileageHistogram(mileageHistogramSpec);
        } else {
          console.log('No valid mileage data for histogram');
          setMileageHistogram(null);
        }
      } catch (error) {
        console.error('Error generating histograms:', error);
        setPriceHistogram(null);
        setMileageHistogram(null);
      }
    } else {
      console.log('No filtered results, clearing histograms');
      setPriceHistogram(null);
      setMileageHistogram(null);
    }
  }, [filteredResults]);

  // Handle histogram bar click
  const handleHistogramBarClick = (name: string, datum: any) => {
    console.log('Histogram bar click:', name, datum);
    
    if (name === 'barClick') {
      // For price histogram
      if (datum.price_bin0 !== undefined && datum.price_bin1 !== undefined) {
        const minPrice = Math.floor(datum.price_bin0).toString();
        const maxPrice = Math.ceil(datum.price_bin1).toString();
        
        console.log(`Setting price filter: ${minPrice} - ${maxPrice}`);
        
        // Update the state values
        setPriceMin(minPrice);
        setPriceMax(maxPrice);
        
        // Show notification
        showNotification(`Price filter set: ${formatCurrency(parseInt(minPrice))} - ${formatCurrency(parseInt(maxPrice))}`);
      }
      // For mileage histogram
      else if (datum.mileage_bin0 !== undefined && datum.mileage_bin1 !== undefined) {
        const minMileage = Math.floor(datum.mileage_bin0).toString();
        const maxMileage = Math.ceil(datum.mileage_bin1).toString();
        
        console.log(`Setting mileage filter: ${minMileage} - ${maxMileage}`);
        
        // Update the state values
        setMileageMin(minMileage);
        setMileageMax(maxMileage);
        
        // Show notification
        showNotification(`Mileage filter set: ${formatNumber(parseInt(minMileage))} - ${formatNumber(parseInt(maxMileage))} miles`);
      }
      // Log if we couldn't identify the histogram type
      else {
        console.warn('Unrecognized histogram data format:', datum);
      }
    }
    // Handle double-click to clear filters
    else if (name === 'clearFilters') {
      console.log('Clearing filters from double-click');
      
      // Clear all filters
      setPriceMin('');
      setPriceMax('');
      setMileageMin('');
      setMileageMax('');
      showNotification('Filters cleared');
    }
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format number with commas
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  // Add console logging for state changes
  useEffect(() => {
    console.log('Price histogram state changed:', priceHistogram ? 'available' : 'null');
  }, [priceHistogram]);

  useEffect(() => {
    console.log('Mileage histogram state changed:', mileageHistogram ? 'available' : 'null');
  }, [mileageHistogram]);

  // Add fetchMakeOptions function after other fetch functions
  const fetchMakeOptions = async () => {
    try {
      console.log('Fetching all makes');
      const response = await fetch('/api/cars?type=makes');
      
      if (response.status === 503) {
        setDbConnectionError(true);
        setMakeOptions([]);
        return;
      }
      
      if (!response.ok) {
        console.error('Make options API error:', response.status, response.statusText);
        setMakeOptions([]);
        return;
      }
      
      setDbConnectionError(false);
      
      const data = await response.json();
      console.log('Received make options data:', data);
      
      if (!data || !Array.isArray(data)) {
        console.error('Invalid make options data format:', data);
        setMakeOptions([]);
        return;
      }
      
      const uniqueMakes = Array.from(new Set(data.map((item: CarMake) => item.make)))
        .filter((make): make is string => !!make)
        .sort();
      
      setMakeOptions(uniqueMakes);
    } catch (error) {
      console.error('Error fetching make options:', error);
      setMakeOptions([]);
    }
  };

  // Add useEffect to fetch makes on component mount
  useEffect(() => {
    fetchMakeOptions();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
              Vehicle Listings
            </h1>
            <p className="mt-2 text-lg text-gray-500 dark:text-gray-300">
              Search for used cars across major platforms
            </p>
          </div>
        </div>
      <style jsx global>{fadeInAnimation}</style>
 
      
      {/* Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-4 py-2 rounded-md shadow-lg animate-fade-in">
          {notification}
        </div>
      )}
      
      {/* Search Form */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Search Listings</CardTitle>
          <CardDescription>Find vehicles that match your criteria</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <FormItem>
                <FormLabel htmlFor="make">
                  Make <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    id="make"
                    name="make"
                    value={make}
                    onChange={handleInputChange}
                    list="makes-list"
                    placeholder="Start typing to select a make"
                    required
                  />
                </FormControl>
                <datalist id="makes-list">
                  {makeOptions.map((make) => (
                    <option key={make} value={make} />
                  ))}
                </datalist>
                {dbConnectionError && (
                  <p className="mt-1 text-sm text-red-500">
                    Database connection error. Some options may not be available.
                  </p>
                )}
              </FormItem>
              
              <FormItem>
                <FormLabel htmlFor="model">
                  Model
                </FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    id="model"
                    name="model"
                    value={model}
                    onChange={handleInputChange}
                    list="models-list"
                    placeholder={make ? `Enter ${make} model...` : "First select a make..."}
                  />
                </FormControl>
                <datalist id="models-list">
                  {modelOptions.map((model) => (
                    <option key={model} value={model} />
                  ))}
                </datalist>
              </FormItem>
              
              <FormItem>
                <FormLabel htmlFor="trim">
                  Trim
                </FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    id="trim"
                    name="trim"
                    value={trim}
                    onChange={handleInputChange}
                    list="trims-list"
                    placeholder={model ? `Enter trim...` : "First select a model..."}
                  />
                </FormControl>
                <datalist id="trims-list">
                  {trimOptions.map((trim) => (
                    <option key={trim} value={trim} />
                  ))}
                </datalist>
              </FormItem>
              
              <FormItem>
                <FormLabel htmlFor="transmission">
                  Transmission
                </FormLabel>
                <FormControl>
                  <Select
                    name="transmission" 
                    value={transmission}
                    onValueChange={(value) => setTransmission(value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select transmission" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Any">Any</SelectItem>
                      <SelectItem value="Automatic">Automatic</SelectItem>
                      <SelectItem value="Manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
              </FormItem>
              
              <FormItem>
                <FormLabel htmlFor="yearMin">
                  Year (Min)
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    id="yearMin"
                    name="yearMin"
                    value={yearMin}
                    onChange={handleInputChange}
                    placeholder="e.g. 1950"
                    min="1900"
                    max="2025"
                  />
                </FormControl>
              </FormItem>
              
              <FormItem>
                <FormLabel htmlFor="yearMax">
                  Year (Max)
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    id="yearMax"
                    name="yearMax"
                    value={yearMax}
                    onChange={handleInputChange}
                    placeholder="e.g. 2025"
                    min="1950"
                    max="2025"
                  />
                </FormControl>
              </FormItem>
              
              <div className="md:col-span-2 lg:col-span-4 flex justify-end">
                <Button
                  type="submit"
                  disabled={loading || !make}
                >
                  {loading ? 'Searching...' : 'Search Listings'}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
      
      {/* Notifications */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <p>{error}</p>
        </div>
      )}
      
      {/* Results Section */}
      {results.length > 0 && (
        <>
          {/* Summary */}
          {summary && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Search Summary</CardTitle>
                <CardDescription>Overview of your search results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Results</p>
                    <p className="text-2xl font-bold">{formatNumber(summary.totalResults)}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Average Price</p>
                    <p className="text-2xl font-bold">{formatCurrency(summary.averagePrice)}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Lowest Price</p>
                    <p className="text-2xl font-bold">{formatCurrency(summary.lowestPrice)}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Highest Price</p>
                    <p className="text-2xl font-bold">{formatCurrency(summary.highestPrice)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Visualizations Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Data Visualizations</CardTitle>
              <CardDescription>
                Click to filter. Double-click to clear the selection.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!priceHistogram && !mileageHistogram && (
                <div className="p-4 bg-yellow-50 text-yellow-800 rounded-md mb-4">
                  Histograms are not available. Check console for errors.
                </div>
              )}
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {priceHistogram ? (
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                    <h3 className="text-lg font-semibold mb-2">Price Distribution</h3>
                    <div className="w-full" style={{ maxWidth: '100%', minHeight: '400px' }}>
                      <VegaChart 
                        spec={priceHistogram} 
                        className="w-full h-auto"
                        onSignalClick={handleHistogramBarClick}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                    <h3 className="text-lg font-semibold mb-2">Price Distribution</h3>
                    <div className="w-full flex items-center justify-center" style={{ minHeight: '400px' }}>
                      <p>Price histogram not available</p>
                    </div>
                  </div>
                )}
                
                {mileageHistogram ? (
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                    <h3 className="text-lg font-semibold mb-2">Mileage Distribution</h3>
                    <div className="w-full" style={{ maxWidth: '100%', minHeight: '400px' }}>
                      <VegaChart 
                        spec={mileageHistogram} 
                        className="w-full h-auto"
                        onSignalClick={handleHistogramBarClick}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                    <h3 className="text-lg font-semibold mb-2">Mileage Distribution</h3>
                    <div className="w-full flex items-center justify-center" style={{ minHeight: '400px' }}>
                      <p>Mileage histogram not available</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Filters and Sorting */}
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className={priceMin || priceMax || mileageMin || mileageMax ? 'text-blue-600 dark:text-blue-400' : ''}>
                  Filter & Sort {(priceMin || priceMax || mileageMin || mileageMax) && <Badge variant="outline" className="ml-2">Active</Badge>}
                </CardTitle>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center">
                    <FormLabel htmlFor="sortBy" className="mr-2 whitespace-nowrap">
                      Sort by:
                    </FormLabel>
                    <Select 
                      value={sortBy}
                      onValueChange={(value) => setSortBy(value)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="price">Price</SelectItem>
                        <SelectItem value="year">Year</SelectItem>
                        <SelectItem value="mileage">Mileage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center">
                    <FormLabel htmlFor="sortOrder" className="mr-2 whitespace-nowrap">
                      Order:
                    </FormLabel>
                    <Select 
                      value={sortOrder}
                      onValueChange={(value) => setSortOrder(value)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Sort order" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">Low to High</SelectItem>
                        <SelectItem value="desc">High to Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormItem>
                  <FormLabel htmlFor="priceMin" className={priceMin ? 'text-blue-600 dark:text-blue-400' : ''}>
                    Price (Min)
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="priceMin"
                      type="number"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      className={priceMin ? 'border-blue-500 dark:border-blue-400' : ''}
                      placeholder="Min Price"
                      min="0"
                    />
                  </FormControl>
                </FormItem>
                
                <FormItem>
                  <FormLabel htmlFor="priceMax" className={priceMax ? 'text-blue-600 dark:text-blue-400' : ''}>
                    Price (Max)
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="priceMax"
                      type="number"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      className={priceMax ? 'border-blue-500 dark:border-blue-400' : ''}
                      placeholder="Max Price"
                      min="0"
                    />
                  </FormControl>
                </FormItem>
                
                <FormItem>
                  <FormLabel htmlFor="mileageMin" className={mileageMin ? 'text-blue-600 dark:text-blue-400' : ''}>
                    Mileage (Min)
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="mileageMin"
                      type="number"
                      value={mileageMin}
                      onChange={(e) => setMileageMin(e.target.value)}
                      className={mileageMin ? 'border-blue-500 dark:border-blue-400' : ''}
                      placeholder="Min Mileage"
                      min="0"
                    />
                  </FormControl>
                </FormItem>
                
                <FormItem>
                  <FormLabel htmlFor="mileageMax" className={mileageMax ? 'text-blue-600 dark:text-blue-400' : ''}>
                    Mileage (Max)
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="mileageMax"
                      type="number"
                      value={mileageMax}
                      onChange={(e) => setMileageMax(e.target.value)}
                      className={mileageMax ? 'border-blue-500 dark:border-blue-400' : ''}
                      placeholder="Max Mileage"
                      min="0"
                    />
                  </FormControl>
                </FormItem>
              </div>
              
              <div className="mt-4 flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  Showing {filteredResults.length} of {results.length} listings
                </div>
                
                <Button
                  variant="ghost"
                  onClick={() => {
                    setPriceMin('');
                    setPriceMax('');
                    setMileageMin('');
                    setMileageMax('');
                    
                    // Show notification if filters were active
                    if (priceMin || priceMax || mileageMin || mileageMax) {
                      showNotification('Filters cleared');
                    }
                  }}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                >
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Listings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredResults.map((listing, index) => (
              <ListingCard key={index} listing={listing} />
            ))}
          </div>
          
          {filteredResults.length === 0 && (
            <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-900/30">
              <CardContent className="p-4">
                <p className="text-yellow-800 dark:text-yellow-200">
                  No listings match your filter criteria. Try adjusting your filters.
                </p>
              </CardContent>
            </Card>
          )}
          
          {/* AI Agent */}
          {filteredResults.length > 0 && (
            <ListingsAIAgent listings={filteredResults} />
          )}
        </>
      )}
      
      {/* No Results State */}
      {!loading && results.length === 0 && !error && (
        <Card className="text-center">
          <CardContent className="p-8">
            <h2 className="text-xl font-semibold mb-2">No Listings Found</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Search for vehicles using the form above to see listings.
            </p>
          </CardContent>
        </Card>
      )}
      
      {/* Loading State */}
      {loading && (
        <Card className="text-center">
          <CardContent className="p-8">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              Searching for listings...
            </p>
          </CardContent>
        </Card>
      )}
      
      {/* AI Agent for all results */}
      {results.length > 0 && filteredResults.length === 0 && (
        <ListingsAIAgent listings={results} />
      )}
    </div>
  </div>
  );
}

// Main component with Suspense boundary
export default function ListingsPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8">Loading...</div>}>
      <ListingsContent />
    </Suspense>
  );
}

