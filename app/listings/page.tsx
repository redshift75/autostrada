'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import ListingCard, { Listing } from '@/components/listings/ListingCard';

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
  Make: string;
};

type CarModel = {
  baseModel: string;
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
  const [yearMin, setYearMin] = useState(searchParams.get('yearMin') || '');
  const [yearMax, setYearMax] = useState(searchParams.get('yearMax') || '');
  
  // State for suggestions
  const [makeSuggestions, setMakeSuggestions] = useState<string[]>([]);
  const [modelSuggestions, setModelSuggestions] = useState<string[]>([]);
  const [showMakeSuggestions, setShowMakeSuggestions] = useState(false);
  const [showModelSuggestions, setShowModelSuggestions] = useState(false);
  
  // Debounce timers
  const makeDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const modelDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // State for database connection status
  const [dbConnectionError, setDbConnectionError] = useState(false);
  
  // Debounced form values
  const debouncedMake = useDebounce(make, 300);
  const debouncedModel = useDebounce(model, 300);
  const debouncedYearMin = useDebounce(yearMin, 300);
  const debouncedYearMax = useDebounce(yearMax, 300);
  
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

  // Fetch make suggestions from Supabase with debounce
  const fetchMakeSuggestions = async (query: string) => {
    if (!query || query.length < 2) {
      setMakeSuggestions([]);
      return;
    }
    
    try {
      console.log('Fetching make suggestions for query:', query);
      const response = await fetch(`/api/cars/makes?query=${encodeURIComponent(query)}`);
      
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
  
  // Fetch model suggestions from Supabase based on selected make
  const fetchModelSuggestions = async (query: string) => {
    if (!query || query.length < 2) {
      setModelSuggestions([]);
      return;
    }
    
    try {
      console.log('Fetching model suggestions for query:', query, 'make:', make);
      const makeParam = make ? `&make=${encodeURIComponent(make)}` : '';
      const response = await fetch(`/api/cars/models?query=${encodeURIComponent(query)}${makeParam}`);
      
      if (!response.ok) {
        console.error('Model suggestions API error:', response.status, response.statusText);
        // Don't throw error, just log it and return empty array
        setModelSuggestions([]);
        return;
      }
      
      const data = await response.json();
      console.log('Received model suggestions data:', data);
      
      if (!data || !Array.isArray(data)) {
        console.error('Invalid model suggestions data format:', data);
        setModelSuggestions([]);
        return;
      }
      
      const uniqueModels = Array.from(new Set(data.map((item: CarModel) => item.baseModel)))
        .filter((baseModel): baseModel is string => !!baseModel)
        .sort()
        .slice(0, 5); // Limit to 5 results
      
      console.log('Processed unique models:', uniqueModels);
      setModelSuggestions(uniqueModels);
      setShowModelSuggestions(uniqueModels.length > 0);
    } catch (error) {
      console.error('Error fetching model suggestions:', error);
      // Don't show error to user, just silently fail
      setModelSuggestions([]);
      setShowModelSuggestions(false);
    }
  };
  
  // Debounced version of fetchModelSuggestions
  const debouncedFetchModelSuggestions = (query: string) => {
    // Clear any existing timer
    if (modelDebounceTimerRef.current) {
      clearTimeout(modelDebounceTimerRef.current);
    }
    
    // Set a new timer
    modelDebounceTimerRef.current = setTimeout(() => {
      fetchModelSuggestions(query);
    }, 300); // 300ms delay
  };
  
  // Handle input changes with debounce for suggestions
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'make') {
      setMake(value);
      debouncedFetchMakeSuggestions(value);
      // Clear model when make changes
      if (model) {
        setModel('');
        setModelSuggestions([]);
      }
    } else if (name === 'model') {
      setModel(value);
      debouncedFetchModelSuggestions(value);
    } else if (name === 'yearMin') {
      setYearMin(value);
    } else if (name === 'yearMax') {
      setYearMax(value);
    }
  };
  
  // Handle suggestion selection
  const handleSuggestionClick = (name: string, value: string) => {
    if (name === 'make') {
      setMake(value);
      setShowMakeSuggestions(false);
      // Focus the model input after selecting a make
      const modelInput = document.getElementById('model');
      if (modelInput) {
        modelInput.focus();
      }
    } else if (name === 'model') {
      setModel(value);
      setShowModelSuggestions(false);
    }
  };
  
  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowMakeSuggestions(false);
      setShowModelSuggestions(false);
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
      if (modelDebounceTimerRef.current) {
        clearTimeout(modelDebounceTimerRef.current);
      }
    };
  }, []);

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
      const response = await fetch('/api/listings/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          make,
          model: model || undefined,
          yearMin: yearMin ? parseInt(yearMin) : undefined,
          yearMax: yearMax ? parseInt(yearMax) : undefined,
          maxResults: 50,
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
      
      // Update URL with search params
      const params = new URLSearchParams();
      if (make) params.set('make', make);
      if (model) params.set('model', model);
      if (yearMin) params.set('yearMin', yearMin);
      if (yearMax) params.set('yearMax', yearMax);
      
      router.push(`/listings?${params.toString()}`);
    } catch (err) {
      setResults([]);
      setSummary(null);
      setPagination(null);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [make, model, yearMin, yearMax, router]);

  // Load results if URL has search params on initial load
  useEffect(() => {
    if (isInitialLoad.current && searchParams.has('make')) {
      handleSearch();
      isInitialLoad.current = false;
    }
  }, [searchParams, handleSearch]);

  // Apply filters and sorting to results
  useEffect(() => {
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

    setFilteredResults(filtered);
  }, [results, priceMin, priceMax, mileageMin, mileageMax, sortBy, sortOrder]);

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

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Car Listings</h1>
      
      {/* Search Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Search Listings</h2>
        
        {dbConnectionError && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6">
            <p className="font-medium">Database connection unavailable</p>
            <p className="text-sm">Autocomplete suggestions are not available. You can still enter make and model manually.</p>
          </div>
        )}
        
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex flex-col relative">
            <label htmlFor="make" className="mb-1 font-medium">
              Make <span className="text-red-500">*</span>
            </label>
            <input
              id="make"
              type="text"
              name="make"
              value={make}
              onChange={handleInputChange}
              onFocus={() => make.length >= 2 && debouncedFetchMakeSuggestions(make)}
              onClick={(e) => e.stopPropagation()}
              className="border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
              placeholder={dbConnectionError ? "Enter car make manually..." : "Start typing to see suggestions..."}
              required
              autoComplete="off"
            />
            {showMakeSuggestions && makeSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 top-full bg-white dark:bg-gray-700 shadow-lg rounded-md border border-gray-200 dark:border-gray-600 max-h-60 overflow-y-auto">
                <div className="py-1">
                  {makeSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors duration-150"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSuggestionClick('make', suggestion);
                      }}
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex flex-col relative">
            <label htmlFor="model" className="mb-1 font-medium">
              Model
            </label>
            <input
              id="model"
              type="text"
              name="model"
              value={model}
              onChange={handleInputChange}
              onFocus={() => model.length >= 2 && debouncedFetchModelSuggestions(model)}
              onClick={(e) => e.stopPropagation()}
              className="border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
              placeholder={dbConnectionError 
                ? "Enter model manually..." 
                : (make ? `Enter ${make} model...` : "First select a make...")}
              autoComplete="off"
            />
            {showModelSuggestions && modelSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 top-full bg-white dark:bg-gray-700 shadow-lg rounded-md border border-gray-200 dark:border-gray-600 max-h-60 overflow-y-auto">
                <div className="py-1">
                  {modelSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors duration-150"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSuggestionClick('model', suggestion);
                      }}
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex flex-col">
            <label htmlFor="yearMin" className="mb-1 font-medium">
              Year (Min)
            </label>
            <input
              id="yearMin"
              type="number"
              name="yearMin"
              value={yearMin}
              onChange={handleInputChange}
              className="border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
              placeholder="e.g. 2015"
              min="1900"
              max="2024"
            />
          </div>
          
          <div className="flex flex-col">
            <label htmlFor="yearMax" className="mb-1 font-medium">
              Year (Max)
            </label>
            <input
              id="yearMax"
              type="number"
              name="yearMax"
              value={yearMax}
              onChange={handleInputChange}
              className="border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
              placeholder="e.g. 2023"
              min="1900"
              max="2024"
            />
          </div>
          
          <div className="md:col-span-2 lg:col-span-4 flex justify-end">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition-colors"
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>
        
        {error && (
          <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}
      </div>
      
      {/* Results Section */}
      {results.length > 0 && (
        <>
          {/* Summary */}
          {summary && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">Search Summary</h2>
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
            </div>
          )}
          
          {/* Filters and Sorting */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <h2 className="text-xl font-semibold">Filter & Sort</h2>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center">
                  <label htmlFor="sortBy" className="mr-2 whitespace-nowrap">
                    Sort by:
                  </label>
                  <select
                    id="sortBy"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="price">Price</option>
                    <option value="year">Year</option>
                    <option value="mileage">Mileage</option>
                  </select>
                </div>
                <div className="flex items-center">
                  <label htmlFor="sortOrder" className="mr-2 whitespace-nowrap">
                    Order:
                  </label>
                  <select
                    id="sortOrder"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="asc">Low to High</option>
                    <option value="desc">High to Low</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col">
                <label htmlFor="priceMin" className="mb-1 font-medium">
                  Price (Min)
                </label>
                <input
                  id="priceMin"
                  type="number"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className="border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
                  placeholder="Min Price"
                  min="0"
                />
              </div>
              
              <div className="flex flex-col">
                <label htmlFor="priceMax" className="mb-1 font-medium">
                  Price (Max)
                </label>
                <input
                  id="priceMax"
                  type="number"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className="border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
                  placeholder="Max Price"
                  min="0"
                />
              </div>
              
              <div className="flex flex-col">
                <label htmlFor="mileageMin" className="mb-1 font-medium">
                  Mileage (Min)
                </label>
                <input
                  id="mileageMin"
                  type="number"
                  value={mileageMin}
                  onChange={(e) => setMileageMin(e.target.value)}
                  className="border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
                  placeholder="Min Mileage"
                  min="0"
                />
              </div>
              
              <div className="flex flex-col">
                <label htmlFor="mileageMax" className="mb-1 font-medium">
                  Mileage (Max)
                </label>
                <input
                  id="mileageMax"
                  type="number"
                  value={mileageMax}
                  onChange={(e) => setMileageMax(e.target.value)}
                  className="border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
                  placeholder="Max Mileage"
                  min="0"
                />
              </div>
            </div>
            
            <div className="mt-4 text-sm text-gray-500">
              Showing {filteredResults.length} of {results.length} listings
            </div>
          </div>
          
          {/* Listings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredResults.map((listing, index) => (
              <ListingCard key={index} listing={listing} />
            ))}
          </div>
          
          {filteredResults.length === 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/30 text-yellow-800 dark:text-yellow-200 p-4 rounded-md">
              No listings match your filter criteria. Try adjusting your filters.
            </div>
          )}
        </>
      )}
      
      {/* No Results State */}
      {!loading && results.length === 0 && !error && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">No Listings Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Search for vehicles using the form above to see listings.
          </p>
        </div>
      )}
      
      {/* Loading State */}
      {loading && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Searching for listings...
          </p>
        </div>
      )}
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
