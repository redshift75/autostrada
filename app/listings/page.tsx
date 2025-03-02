'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import ListingCard, { Listing } from '@/components/listings/ListingCard';
import ListingsAIAgent from '@/components/listings/ListingsAIAgent';
import { generateListingPriceHistogram, generateListingMileageHistogram } from '@/lib/utils/visualization';
import type { TopLevelSpec } from 'vega-lite';

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !spec) {
      console.log('VegaChart: Missing container or spec', { hasContainer: !!containerRef.current, hasSpec: !!spec });
      return;
    }

    console.log('VegaChart: Rendering chart with spec type:', typeof spec);
    console.log('VegaChart: Spec description:', (spec as any).description);

    // Clear any previous errors
    setError(null);

    // Dynamically import vega-embed to avoid SSR issues
    import('vega-embed').then(({ default: vegaEmbed }) => {
      console.log('vega-embed loaded successfully');
      
      try {
        // Ensure we're working with a proper Vega-Lite specification
        if (typeof spec === 'string') {
          try {
            // Try to parse it as JSON
            const parsedSpec = JSON.parse(spec);
            renderChart(parsedSpec, vegaEmbed);
          } catch (error) {
            console.error('Failed to parse string spec:', error);
            setError('Failed to parse chart specification');
            return;
          }
        } else {
          // Continue with the object spec
          renderChart(spec, vegaEmbed);
        }
      } catch (error) {
        console.error('Error in VegaChart component:', error);
        setError('Error initializing chart');
      }
    }).catch(error => {
      console.error('Failed to load vega-embed:', error);
      setError('Failed to load visualization library');
    });

    function renderChart(chartSpec: any, vegaEmbed: any) {
      try {
        // Check if the spec has required Vega-Lite properties
        const specAny = chartSpec as any;
        if (!specAny.mark && !specAny.layer && !specAny.facet && !specAny.hconcat && 
            !specAny.vconcat && !specAny.concat && !specAny.repeat) {
          console.error('Invalid Vega-Lite specification: Missing required properties', chartSpec);
          setError('Invalid chart specification');
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
        if (specAny.description === 'Listing Price Distribution' || specAny.description === 'Listing Mileage Distribution') {
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

          vegaEmbed(containerRef.current!, histogramSpec as any, {
            actions: { export: true, source: false, compiled: false, editor: false },
            renderer: 'svg',
            mode: 'vega-lite'
          }).then((result: any) => {
            viewRef.current = result.view;
            
            // Add signal listener for histogram bar clicks
            if (onSignalClick) {
              result.view.addEventListener('click', (event: any, item: any) => {
                if (item && item.datum) {
                  onSignalClick('barClick', item.datum);
                }
              });
            }
          }).catch((error: Error) => {
            console.error('Error rendering Vega chart:', error);
            console.error('Problematic spec:', JSON.stringify(histogramSpec));
            setError('Error rendering chart');
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
            setError('Error rendering chart');
          });
        }
      } catch (error) {
        console.error('Error in renderChart function:', error);
        setError('Error preparing chart');
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

  return (
    <div className="relative">
      <div ref={containerRef} className={className} style={{ minHeight: "400px" }} />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80">
          <div className="text-red-600 dark:text-red-400 text-center p-4">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
        </div>
      )}
    </div>
  );
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
  
  // Notification state
  const [notification, setNotification] = useState<string | null>(null);
  
  // Debounce timers
  const makeDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const modelDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const notificationTimerRef = useRef<NodeJS.Timeout | null>(null);
  
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

  // Add state for visualizations
  const [priceHistogram, setPriceHistogram] = useState<TopLevelSpec | null>(null);
  const [mileageHistogram, setMileageHistogram] = useState<TopLevelSpec | null>(null);
  
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
          const priceHistogramSpec = generateListingPriceHistogram(validPriceListings);
          console.log('Price histogram spec generated:', priceHistogramSpec);
          setPriceHistogram(priceHistogramSpec);
        } else {
          console.log('No valid price data for histogram');
          setPriceHistogram(null);
        }
        
        if (validMileageListings.length > 0) {
          const mileageHistogramSpec = generateListingMileageHistogram(validMileageListings);
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
    if (name === 'barClick') {
      if (datum.price_bin0 !== undefined && datum.price_bin1 !== undefined) {
        // Price histogram was clicked
        const minPrice = Math.floor(datum.price_bin0).toString();
        const maxPrice = Math.ceil(datum.price_bin1).toString();
        
        console.log(`Setting price filter: ${minPrice} - ${maxPrice}`);
        
        // Update the state values
        setPriceMin(minPrice);
        setPriceMax(maxPrice);
        
        // Show notification
        showNotification(`Price filter set: ${formatCurrency(parseInt(minPrice))} - ${formatCurrency(parseInt(maxPrice))}`);
      } else if (datum.mileage_bin0 !== undefined && datum.mileage_bin1 !== undefined) {
        // Mileage histogram was clicked
        const minMileage = Math.floor(datum.mileage_bin0).toString();
        const maxMileage = Math.ceil(datum.mileage_bin1).toString();
        
        console.log(`Setting mileage filter: ${minMileage} - ${maxMileage}`);
        
        // Update the state values
        setMileageMin(minMileage);
        setMileageMax(maxMileage);
        
        // Show notification
        showNotification(`Mileage filter set: ${formatNumber(parseInt(minMileage))} - ${formatNumber(parseInt(maxMileage))} miles`);
      }
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

  return (
    <div className="container mx-auto px-4 py-8">
      <style jsx global>{fadeInAnimation}</style>
      
      <h1 className="text-3xl font-bold mb-8">Car Listings</h1>
      
      {/* Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-4 py-2 rounded-md shadow-lg animate-fade-in">
          {notification}
        </div>
      )}
      
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
          
          {/* Visualizations Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Data Visualizations</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Click on a bar to filter by that range. Double-click to clear the selection.
            </p>
            
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
          </div>
          
          {/* Filters and Sorting */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <h2 className={`text-xl font-semibold ${priceMin || priceMax || mileageMin || mileageMax ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                Filter & Sort {(priceMin || priceMax || mileageMin || mileageMax) && <span className="text-sm font-normal">(Active)</span>}
              </h2>
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
                <label htmlFor="priceMin" className={`mb-1 font-medium ${priceMin ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                  Price (Min)
                </label>
                <input
                  id="priceMin"
                  type="number"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className={`border rounded-md p-2 dark:bg-gray-700 ${priceMin ? 'border-blue-500 dark:border-blue-400' : 'border-gray-300 dark:border-gray-600'}`}
                  placeholder="Min Price"
                  min="0"
                />
              </div>
              
              <div className="flex flex-col">
                <label htmlFor="priceMax" className={`mb-1 font-medium ${priceMax ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                  Price (Max)
                </label>
                <input
                  id="priceMax"
                  type="number"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className={`border rounded-md p-2 dark:bg-gray-700 ${priceMax ? 'border-blue-500 dark:border-blue-400' : 'border-gray-300 dark:border-gray-600'}`}
                  placeholder="Max Price"
                  min="0"
                />
              </div>
              
              <div className="flex flex-col">
                <label htmlFor="mileageMin" className={`mb-1 font-medium ${mileageMin ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                  Mileage (Min)
                </label>
                <input
                  id="mileageMin"
                  type="number"
                  value={mileageMin}
                  onChange={(e) => setMileageMin(e.target.value)}
                  className={`border rounded-md p-2 dark:bg-gray-700 ${mileageMin ? 'border-blue-500 dark:border-blue-400' : 'border-gray-300 dark:border-gray-600'}`}
                  placeholder="Min Mileage"
                  min="0"
                />
              </div>
              
              <div className="flex flex-col">
                <label htmlFor="mileageMax" className={`mb-1 font-medium ${mileageMax ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                  Mileage (Max)
                </label>
                <input
                  id="mileageMax"
                  type="number"
                  value={mileageMax}
                  onChange={(e) => setMileageMax(e.target.value)}
                  className={`border rounded-md p-2 dark:bg-gray-700 ${mileageMax ? 'border-blue-500 dark:border-blue-400' : 'border-gray-300 dark:border-gray-600'}`}
                  placeholder="Max Mileage"
                  min="0"
                />
              </div>
            </div>
            
            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                Showing {filteredResults.length} of {results.length} listings
              </div>
              
              <button
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
              </button>
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
          
          {/* AI Agent */}
          {filteredResults.length > 0 && (
            <ListingsAIAgent listings={filteredResults} />
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
      
      {/* AI Agent for all results */}
      {results.length > 0 && filteredResults.length === 0 && (
        <ListingsAIAgent listings={results} />
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
