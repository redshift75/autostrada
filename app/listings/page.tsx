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

// Create a separate component that uses useSearchParams
function ListingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Form state
  const [make, setMake] = useState(searchParams.get('make') || '');
  const [model, setModel] = useState(searchParams.get('model') || '');
  const [yearMin, setYearMin] = useState(searchParams.get('yearMin') || '');
  const [yearMax, setYearMax] = useState(searchParams.get('yearMax') || '');

  
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
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex flex-col">
            <label htmlFor="make" className="mb-1 font-medium">
              Make <span className="text-red-500">*</span>
            </label>
            <input
              id="make"
              type="text"
              value={make}
              onChange={(e) => setMake(e.target.value)}
              className="border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
              placeholder="e.g. Toyota"
              required
            />
          </div>
          
          <div className="flex flex-col">
            <label htmlFor="model" className="mb-1 font-medium">
              Model
            </label>
            <input
              id="model"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
              placeholder="e.g. Camry"
            />
          </div>
          
          <div className="flex flex-col">
            <label htmlFor="yearMin" className="mb-1 font-medium">
              Year (Min)
            </label>
            <input
              id="yearMin"
              type="number"
              value={yearMin}
              onChange={(e) => setYearMin(e.target.value)}
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
              value={yearMax}
              onChange={(e) => setYearMax(e.target.value)}
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
