'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';

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
};

export default function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get make and model from URL query parameters if they exist
  const makeParam = searchParams.get('make');
  const modelParam = searchParams.get('model');
  const showFormParam = searchParams.get('showForm');
  
  // Form state for generating new visualizations
  const [formData, setFormData] = useState({
    make: makeParam || '',
    model: modelParam || '',
    yearMin: 1950,
    yearMax: 2025,
    maxPages: 5,
  });
  
  // State for showing/hiding the generation form
  const [showGenerationForm, setShowGenerationForm] = useState(showFormParam === 'true');
  
  // State for visualizations and results
  const [visualizations, setVisualizations] = useState<{
    timeSeriesChart?: string;
    priceHistogram?: string;
    priceYearScatter?: string;
  } | null>(null);
  
  const [summary, setSummary] = useState<{
    totalResults?: number;
    averageSoldPrice?: string;
    highestSoldPrice?: string;
    lowestSoldPrice?: string;
    soldPercentage?: string;
  } | null>(null);
  
  const [results, setResults] = useState<AuctionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchVisualizations() {
      try {
        setLoading(true);
        setError(null);
        
        // If make and model are provided in URL, fetch specific visualizations
        const endpoint = makeParam && modelParam 
          ? `/api/visualizations?make=${makeParam}&model=${modelParam}`
          : '/api/visualizations/latest';
        
        const response = await fetch(endpoint);
        
        if (!response.ok) {
          throw new Error(`Error fetching visualizations: ${response.statusText}`);
        }
        
        const data = await response.json();
        setVisualizations(data.visualizations);
        setSummary(data.summary);
        
        // Set auction results if available
        if (data.results && Array.isArray(data.results)) {
          setResults(data.results);
        }
      } catch (err) {
        console.error('Error fetching visualizations:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    }
    
    fetchVisualizations();
  }, [makeParam, modelParam]);
  
  // Function to extract image URL from auction title or use a placeholder
  const getImageUrl = (result: AuctionResult) => {
    // First check if we have the images object with small image URL from BAT API
    if (result.images && result.images.small && result.images.small.url) {
      return result.images.small.url;
    }
    
    // Fall back to image_url if available
    if (result.image_url) return result.image_url;
    
    // Use placeholder as last resort
    const make = result.make || makeParam || 'Car';
    const model = result.model || modelParam || '';
    return `https://via.placeholder.com/100x75?text=${make}+${model}`;
  };
  
  // Function to format price for display
  const formatPrice = (price: string) => {
    if (price === 'Not sold') return 'Not sold';
    return price;
  };
  
  // Extract make and model from title if not provided
  const extractMakeModel = (result: AuctionResult) => {
    if (result.make && result.model) {
      return { make: result.make, model: result.model };
    }
    
    // Try to extract from title
    const titleParts = result.title.split(' ');
    if (titleParts.length >= 2) {
      return {
        make: titleParts[0],
        model: titleParts[1]
      };
    }
    
    return { make: 'Unknown', model: '' };
  };
  
  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'yearMin' || name === 'yearMax' || name === 'maxPages' 
        ? parseInt(value, 10) 
        : value
    }));
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.make || !formData.model) {
      setError('Make and Model are required fields');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const response = await fetch('/api/visualizations/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate visualizations');
      }
      
      const data = await response.json();
      setSuccess('Visualizations generated successfully!');
      
      // Hide the form and update the URL to show the new visualizations
      setShowGenerationForm(false);
      router.push(`/dashboard?make=${formData.make}&model=${formData.model}`);
      
    } catch (err) {
      console.error('Error generating visualizations:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">
        {makeParam && modelParam 
          ? `${makeParam} ${modelParam} Auction Results` 
          : 'Auction Results Dashboard'}
      </h1>
      
      <div className="flex justify-between items-center mb-6">
        <p className="text-gray-600">
          {makeParam && modelParam 
            ? `Viewing auction results for ${makeParam} ${modelParam}`
            : 'View and analyze auction results for classic cars.'}
        </p>
        <button 
          onClick={() => setShowGenerationForm(!showGenerationForm)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {showGenerationForm ? 'Hide Form' : 'Generate New Visualizations'}
        </button>
      </div>
      
      {/* Generation Form */}
      {showGenerationForm && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Generate New Visualizations</h2>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <p>{error}</p>
            </div>
          )}
          
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              <p>{success}</p>
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="make" className="block text-sm font-medium text-gray-700 mb-1">
                  Make *
                </label>
                <input
                  type="text"
                  id="make"
                  name="make"
                  value={formData.make}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. Porsche"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">
                  Model *
                </label>
                <input
                  type="text"
                  id="model"
                  name="model"
                  value={formData.model}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. 911"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="yearMin" className="block text-sm font-medium text-gray-700 mb-1">
                  Minimum Year
                </label>
                <input
                  type="number"
                  id="yearMin"
                  name="yearMin"
                  value={formData.yearMin}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  min="1900"
                  max={new Date().getFullYear()}
                />
              </div>
              
              <div>
                <label htmlFor="yearMax" className="block text-sm font-medium text-gray-700 mb-1">
                  Maximum Year
                </label>
                <input
                  type="number"
                  id="yearMax"
                  name="yearMax"
                  value={formData.yearMax}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  min="1900"
                  max={new Date().getFullYear()}
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
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  max="50"
                />
                <p className="text-xs text-gray-500 mt-1">Higher values will take longer but provide more data.</p>
              </div>
            </div>
            
            <div className="mt-8 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : (
                  'Generate Visualizations'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
      
      {loading && !showGenerationForm && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}
      
      {error && !showGenerationForm && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
          <p className="mt-2">
            Please make sure you have generated visualizations first.
          </p>
        </div>
      )}
      
      {!loading && !error && summary && !showGenerationForm && (
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left column - Summary and Visualizations */}
          <div className="lg:w-2/3">
            <div className="bg-white shadow-md rounded-lg p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-gray-500 text-sm">Total Results</p>
                  <p className="text-2xl font-bold">{summary.totalResults}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-gray-500 text-sm">Average Sold Price</p>
                  <p className="text-2xl font-bold">{summary.averageSoldPrice}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-gray-500 text-sm">Highest Sold Price</p>
                  <p className="text-2xl font-bold">{summary.highestSoldPrice}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-gray-500 text-sm">Sold Percentage</p>
                  <p className="text-2xl font-bold">{summary.soldPercentage}</p>
                </div>
              </div>
            </div>
            
            {visualizations && (
              <div className="grid grid-cols-1 gap-8">
                {visualizations.timeSeriesChart && (
                  <div className="bg-white shadow-md rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">Price Trends Over Time</h2>
                    <img 
                      src={visualizations.timeSeriesChart} 
                      alt="Price Trends Over Time" 
                      className="w-full h-auto"
                    />
                  </div>
                )}
                
                {visualizations.priceHistogram && (
                  <div className="bg-white shadow-md rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">Price Distribution</h2>
                    <img 
                      src={visualizations.priceHistogram} 
                      alt="Price Distribution" 
                      className="w-full h-auto"
                    />
                  </div>
                )}
                
                {visualizations.priceYearScatter && (
                  <div className="bg-white shadow-md rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">Price vs Year</h2>
                    <img 
                      src={visualizations.priceYearScatter} 
                      alt="Price vs Year" 
                      className="w-full h-auto"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Right column - Detailed Results */}
          <div className="lg:w-1/3">
            <div className="bg-white shadow-md rounded-lg p-6 h-full overflow-auto">
              <h2 className="text-xl font-semibold mb-4">Detailed Results</h2>
              
              {results.length === 0 ? (
                <p className="text-gray-500">No detailed results available.</p>
              ) : (
                <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2">
                  {results.map((result, index) => {
                    const { make, model } = extractMakeModel(result);
                    return (
                      <div key={index} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="w-24 h-18 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
                            <img 
                              src={getImageUrl(result)} 
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
                                {formatPrice(result.sold_price)}
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
                              
                              {/* Link to view more results for this make/model */}
                              {!makeParam && !modelParam && make && model && (
                                <Link 
                                  href={`/dashboard?make=${make}&model=${model}`}
                                  className="text-xs text-blue-600 hover:underline inline-block"
                                >
                                  View All {make} {model}
                                </Link>
                              )}
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
      )}
      <div className="mt-8">
      </div>
    </div>
  );
} 